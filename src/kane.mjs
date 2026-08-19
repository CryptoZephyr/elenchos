import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { normalizeVerificationStatus } from "./domain.mjs";
import { commandExists, globalNpmRoot, runCommand } from "./process.mjs";
import { redactText, redactValue, trimForLog } from "./utils.mjs";

function packageKanePath() {
  const root = globalNpmRoot();
  if (!root) return null;
  const candidate = join(root, "@testmuai", "kane-cli", "bin", "kane-cli.cjs");
  return existsSync(candidate) ? candidate : null;
}

export function locateKaneInvocation(config = {}) {
  const configured = config.command ?? process.env.KANE_CLI_PATH;
  if (configured) {
    if (configured.endsWith(".cjs") || configured.endsWith(".js")) {
      return { command: process.execPath, prefixArgs: [configured], source: configured, installed: true };
    }
    return { command: configured, prefixArgs: [], source: configured, installed: true };
  }
  const packagePath = packageKanePath();
  if (packagePath) return { command: process.execPath, prefixArgs: [packagePath], source: packagePath, installed: true };
  if (commandExists("kane-cli")) {
    const command = process.platform === "win32" ? "kane-cli.cmd" : "kane-cli";
    return { command, prefixArgs: [], source: "PATH", installed: true };
  }
  return { command: process.platform === "win32" ? "npx.cmd" : "npx", prefixArgs: ["--yes", "@testmuai/kane-cli"], source: "npx-fallback", installed: false };
}

export async function checkKaneReadiness(config = {}) {
  const invocation = locateKaneInvocation(config);
  if (!invocation.installed) {
    return { ready: false, installed: false, source: invocation.source, action: "Install Kane with npm install -g @testmuai/kane-cli" };
  }
  const result = await runCommand({
    command: invocation.command,
    args: [...invocation.prefixArgs, "whoami"],
    timeoutMs: 30000,
  });
  const balance = result.exitCode === 0 && !result.timedOut
    ? await runCommand({
      command: invocation.command,
      args: [...invocation.prefixArgs, "balance"],
      timeoutMs: 30000,
    })
    : null;
  const ready = result.exitCode === 0 && !result.timedOut && balance?.exitCode === 0 && !balance.timedOut;
  return {
    ready,
    installed: true,
    source: invocation.source,
    action: ready ? null : "Authenticate Kane with kane-cli login and confirm kane-cli balance",
  };
}

export function parseJsonLines(text) {
  const events = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try { events.push(JSON.parse(trimmed)); } catch { /* Kane may mix display text with NDJSON. */ }
  }
  return events;
}

function readResultMarkdown(path) {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  const frontmatter = text.match(/^---\s*([\s\S]*?)\s*---/);
  const statusLine = frontmatter?.[1]?.match(/^status\s*:\s*([^\s#]+)/mi)?.[1];
  const sessionId = frontmatter?.[1]?.match(/^session_id\s*:\s*([^\s#]+)/mi)?.[1] ?? null;
  const started = frontmatter?.[1]?.match(/^started\s*:\s*(.+)$/mi)?.[1]?.trim() ?? null;
  const status = normalizeVerificationStatus(statusLine);
  const steps = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*[-*]?\s*([✓✗⏭])\s+(.+)$/);
    if (match) steps.push({ marker: match[1], description: match[2].trim() });
  }
  return { status, sessionId, started, steps, markdown: trimForLog(text, 24000) };
}

function statusFromEvents(events, { exitCode, timedOut } = {}) {
  if (events.length === 0) return "VERIFIER_ERROR";
  const bugVerdict = bugVerdictFromEvents(events);
  const hasProductVerdict = bugVerdict && !isVerifierFailure(bugVerdict);
  const hasTestMdEvents = events.some((event) => String(event.type ?? "").startsWith("test_md_"));
  const testMdDone = events.filter((event) => event.type === "test_md_done").at(-1);
  if (hasTestMdEvents && !testMdDone && !hasProductVerdict) return "VERIFIER_ERROR";
  const testMdStepEnds = events.filter((event) => event.type === "test_md_step_end");
  const testMdStatuses = testMdStepEnds.map((event) => normalizeVerificationStatus(event.status));
  if (testMdStatuses.includes("FAIL")) {
    return timedOut && !hasProductVerdict ? "VERIFIER_ERROR" : "FAIL";
  }

  const testMdSummary = events.filter((event) => event.type === "test_md_summary").at(-1);
  const testMdSummaryStatus = normalizeVerificationStatus(testMdSummary?.overall_status);
  if (testMdSummaryStatus === "FAIL") {
    return timedOut && !hasProductVerdict ? "VERIFIER_ERROR" : "FAIL";
  }

  const runEnds = events.filter((event) => ["run_end", "run_finished"].includes(event.type));
  const terminal = runEnds.at(-1);
  const terminalStatus = normalizeVerificationStatus(terminal?.status);
  if (terminalStatus === "FAIL") {
    return timedOut && !hasProductVerdict ? "VERIFIER_ERROR" : "FAIL";
  }

  if (timedOut) return "VERIFIER_ERROR";

  if (testMdStepEnds.length > 0) {
    if (testMdStatuses.includes("VERIFIER_ERROR")) return "VERIFIER_ERROR";
    if (testMdStatuses.every((status) => status === "PASS") && exitCode === 0) return "PASS";
    return exitCode !== 0 ? "VERIFIER_ERROR" : "INCONCLUSIVE";
  }

  if (terminal) {
    if (terminalStatus !== "INCONCLUSIVE") return terminalStatus;
  }
  if (events.some((event) => event.type === "error")) return "VERIFIER_ERROR";
  return exitCode !== 0 ? "VERIFIER_ERROR" : "INCONCLUSIVE";
}

function bugVerdictFromEvents(events) {
  const terminal = [...events].reverse().find((event) => ["run_end", "run_finished"].includes(event.type));
  return terminal?.verdict
    ?? [...events].reverse().find((event) => event.type === "test_md_bug_verdict")
    ?? null;
}

function isVerifierFailure(verdict) {
  const family = String(verdict?.family ?? "").toLowerCase();
  const category = String(verdict?.category ?? "").toLowerCase();
  return ["environment_issue", "platform_failure", "infrastructure_error", "verifier_error"].includes(family)
    || ["environment_issue", "platform_failure", "infrastructure_error", "verifier_error"].includes(category);
}

function mapCriteria(criteria, overall, steps = [], events = []) {
  const testMdStepEnds = events.filter((event) => event.type === "test_md_step_end");
  const hasTestMdSteps = testMdStepEnds.length > 0 || events.some((event) => event.type === "test_md_step_start");
  const canMapRootSteps = testMdStepEnds.length === criteria.length
    || (testMdStepEnds.length > 1 && testMdStepEnds.length < criteria.length);

  return criteria.map((criterion, index) => {
    const markdownStep = steps.find((item) => item.description.includes(criterion.id));
    const rootStep = canMapRootSteps ? testMdStepEnds.find((event) => {
      const stepIndex = event.step_index ?? event.stepIndex;
      return stepIndex === index + 1;
    }) : null;
    let status = "UNVERIFIED";
    if (rootStep) {
      const normalized = normalizeVerificationStatus(rootStep.status);
      if (normalized === "PASS") status = "PASS";
      else if (normalized === "FAIL" && overall !== "VERIFIER_ERROR") status = "FAIL";
    } else if (!events.length && markdownStep?.marker === "✓") status = "PASS";
    else if (!events.length && markdownStep?.marker === "✗") status = "FAIL";
    else if (overall === "PASS") status = "PASS";
    else if (overall === "FAIL" && !hasTestMdSteps) status = "FAIL";
    return { ...criterion, status };
  });
}

export function parseKaneResult({ stdout, stderr, exitCode, timedOut = false, resultMarkdownPath, criteria = [] }) {
  const events = parseJsonLines(stdout);
  const markdown = readResultMarkdown(resultMarkdownPath);
  const bugVerdict = bugVerdictFromEvents(events);
  const eventStatus = statusFromEvents(events, { exitCode, timedOut });
  const status = eventStatus;
  const normalizedStatus = isVerifierFailure(bugVerdict)
    ? "VERIFIER_ERROR"
    : status === "INCONCLUSIVE" && (exitCode !== 0 || timedOut)
      ? "VERIFIER_ERROR"
      : status;
  const terminal = [...events].reverse().find((event) => ["run_end", "run_finished"].includes(event.type));
  const summary = [...events].reverse().find((event) => event.type === "test_md_summary");
  const sessionEvent = [...events].reverse().find((event) => event.session_id || event.sessionId);
  const sessionId = sessionEvent?.session_id ?? sessionEvent?.sessionId ?? null;
  const currentMarkdown = markdown?.sessionId && sessionId && markdown.sessionId === sessionId ? markdown : null;
  return {
    status: normalizedStatus,
    exitCode,
    sessionId,
    criteria: mapCriteria(criteria, normalizedStatus, currentMarkdown?.steps ?? [], events),
    events: redactValue(events),
    summary: terminal?.summary || bugVerdict?.root_cause || bugVerdict?.one_liner || null,
    oneLiner: terminal?.one_liner || bugVerdict?.one_liner || null,
    reason: terminal?.reason ?? summary?.overall_status ?? null,
    finalState: redactValue(terminal?.final_state ?? null),
    credits: terminal?.credits_consumed ?? terminal?.credits ?? null,
    duration: terminal?.duration ?? summary?.duration_s ?? null,
    testUrl: terminal?.test_url ?? null,
    bugVerdict: redactValue(bugVerdict),
    failedStep: events.find((event) => event.type === "test_md_step_end" && normalizeVerificationStatus(event.status) === "FAIL")?.step_index
      ?? events.find((event) => event.type === "step_end" && normalizeVerificationStatus(event.status) === "FAIL")?.index
      ?? null,
    resultMarkdownPath: currentMarkdown ? resultMarkdownPath : null,
    rawEvidence: {
      stdout: trimForLog(stdout),
      stderr: trimForLog(stderr),
      resultMarkdown: currentMarkdown?.markdown ?? null,
    },
  };
}

function persistRawEvidence(directory, stdout, stderr) {
  if (!directory) return null;
  mkdirSync(directory, { recursive: true });
  const stdoutPath = join(directory, "kane.stdout.ndjson");
  const stderrPath = join(directory, "kane.stderr.log");
  writeFileSync(stdoutPath, redactText(stdout), "utf8");
  writeFileSync(stderrPath, redactText(stderr), "utf8");
  return { stdoutPath, stderrPath };
}

export async function runKaneTest({ testFile, cwd, criteria = [], config = {}, evidenceDirectory }) {
  const invocation = locateKaneInvocation(config);
  const relativeTestPath = relative(cwd, testFile) || basename(testFile);
  const testArgument = relativeTestPath.startsWith("..") ? testFile : relativeTestPath;
  const args = [
    ...invocation.prefixArgs,
    "testmd",
    "run",
    testArgument,
    "--agent",
  ];
  if (config.headless !== false) args.push("--headless");
  if (config.timeoutSeconds) args.push("--timeout", String(config.timeoutSeconds));
  const result = await runCommand({
    command: invocation.command,
    args,
    cwd,
    timeoutMs: ((config.timeoutSeconds ?? 120) + 30) * 1000,
  });
  const stem = basename(testFile).replace(/_test\.md$/i, "");
  const resultMarkdownPath = join(dirname(testFile), `output-${stem}`, "Result.md");
  const parsed = parseKaneResult({
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    resultMarkdownPath,
    criteria,
  });
  return {
    ...parsed,
    invocation: invocation.source,
    timedOut: result.timedOut,
    evidencePaths: persistRawEvidence(evidenceDirectory, result.stdout, result.stderr),
  };
}

export { readResultMarkdown };
