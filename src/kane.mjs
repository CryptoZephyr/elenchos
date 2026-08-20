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
    return { command: "kane-cli", prefixArgs: [], source: "PATH", installed: true };
  }
  return { command: "npx", prefixArgs: ["--yes", "@testmuai/kane-cli"], source: "npx-fallback", installed: false };
}

function commandOutput(result) {
  return trimForLog([result.stdout, result.stderr].filter(Boolean).join("\n"), 4000);
}

function fieldFromOutput(output, label) {
  return output.match(new RegExp(`^\\s*${label}\\s+(.+?)\\s*$`, "im"))?.[1]?.trim() ?? null;
}

function creditFromOutput(output, label) {
  const value = fieldFromOutput(output, label);
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").match(/[0-9]+(?:\.[0-9]+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseKaneIdentity(result) {
  const output = commandOutput(result);
  const unauthenticated = /not authenticated|token expired|credentials rejected|re-login|login required/i.test(output);
  const authenticated = result.exitCode === 0 && !result.timedOut && !unauthenticated;
  return {
    status: authenticated ? "authenticated" : "needs_authentication",
    authenticated,
    profile: fieldFromOutput(output, "Profile"),
    environment: fieldFromOutput(output, "Environment"),
    method: fieldFromOutput(output, "Method"),
    expires: fieldFromOutput(output, "Expires"),
  };
}

export function parseKaneBalance(result) {
  const output = commandOutput(result);
  const available = creditFromOutput(output, "Available credits:");
  const total = creditFromOutput(output, "Total credits:");
  const availableStatus = result.exitCode === 0 && !result.timedOut ? "available" : "unavailable";
  return {
    status: availableStatus,
    available,
    total,
  };
}

export async function checkKaneReadiness(config = {}) {
  const invocation = locateKaneInvocation(config);
  if (!invocation.installed) {
    return {
      ready: false,
      installed: false,
      source: invocation.source,
      action: "Install Kane with npm install -g @testmuai/kane-cli",
      identity: { status: "not_checked", authenticated: false, profile: null, environment: null, method: null, expires: null },
      balance: { status: "not_checked", available: null, total: null },
    };
  }
  const identityResult = await runCommand({
    command: invocation.command,
    args: [...invocation.prefixArgs, "whoami"],
    env: { KANE_CLI_USER_AGENT: "elenchos" },
    timeoutMs: 30000,
  });
  const balanceResult = await runCommand({
    command: invocation.command,
    args: [...invocation.prefixArgs, "balance"],
    env: { KANE_CLI_USER_AGENT: "elenchos" },
    timeoutMs: 30000,
  });
  const identity = parseKaneIdentity(identityResult);
  const balance = parseKaneBalance(balanceResult);
  const ready = identity.authenticated && balance.status === "available";
  return {
    ready,
    installed: true,
    source: invocation.source,
    identity,
    balance,
    action: ready ? null : identity.authenticated
      ? "Confirm Kane credits with kane-cli balance"
      : "Authenticate Kane with kane-cli login, then confirm kane-cli balance",
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
  if (!path || !existsSync(path)) return null;
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

function statusFromEvents(events, { exitCode, timedOut, cancelled = false, requireTestMd = false } = {}) {
  if (cancelled) return "VERIFIER_ERROR";
  if (events.length === 0) return "VERIFIER_ERROR";
  const bugVerdict = bugVerdictFromEvents(events);
  const hasConfirmedProductVerdict = isConfirmedProductVerdict(bugVerdict);
  const hasTestMdEvents = events.some((event) => String(event.type ?? "").startsWith("test_md_"));
  if (requireTestMd && !hasTestMdEvents) return "VERIFIER_ERROR";
  const hasErrorEvent = events.some((event) => event.type === "error");

  if (hasTestMdEvents) {
    const testMdDone = events.filter((event) => event.type === "test_md_done").at(-1);
    const stepStatuses = events
      .filter((event) => event.type === "test_md_step_end")
      .map((event) => normalizeVerificationStatus(event.status));
    const summary = events.filter((event) => event.type === "test_md_summary").at(-1);
    const summaryStatus = normalizeVerificationStatus(summary?.overall_status ?? summary?.status);
    const doneStatus = normalizeVerificationStatus(testMdDone?.overall_status ?? testMdDone?.status);
    const hasExplicitFailure = stepStatuses.includes("FAIL") || summaryStatus === "FAIL" || doneStatus === "FAIL";

    if (!testMdDone) {
      return hasExplicitFailure && hasConfirmedProductVerdict ? "FAIL" : "VERIFIER_ERROR";
    }
    if (isVerifierFailure(bugVerdict) || stepStatuses.includes("VERIFIER_ERROR") || hasErrorEvent) {
      return "VERIFIER_ERROR";
    }
    if (hasExplicitFailure) {
      return timedOut && !hasConfirmedProductVerdict ? "VERIFIER_ERROR" : "FAIL";
    }
    if (timedOut || exitCode !== 0) return "VERIFIER_ERROR";
    if (doneStatus !== "PASS") return "INCONCLUSIVE";
    if (stepStatuses.some((status) => status !== "PASS")) return "INCONCLUSIVE";
    return "PASS";
  }

  const terminal = events.filter((event) => ["run_end", "run_finished"].includes(event.type)).at(-1);
  const terminalStatus = normalizeVerificationStatus(terminal?.status);
  if (isVerifierFailure(bugVerdict) || hasErrorEvent) return "VERIFIER_ERROR";
  if (terminalStatus === "FAIL") {
    return timedOut && !hasConfirmedProductVerdict ? "VERIFIER_ERROR" : "FAIL";
  }
  if (timedOut || exitCode !== 0) return "VERIFIER_ERROR";
  return terminalStatus;
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

function isConfirmedProductVerdict(verdict) {
  return Boolean(verdict) && verdict.confirmed === true && !isVerifierFailure(verdict);
}

function eventText(event) {
  return [event?.remark, event?.summary, event?.message, event?.heading, event?.title, event?.name, event?.description]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim())
    .join(" ");
}

function meaningfulEvents(events) {
  return events
    .map((event) => ({
      step: event.step ?? event.step_index ?? event.stepIndex ?? event.index ?? null,
      status: normalizeVerificationStatus(event.status),
      text: eventText(event),
      type: event.type ?? null,
    }))
    .filter((event) => event.text || event.status !== "INCONCLUSIVE");
}

function summarizeExecution(events) {
  const progress = events.filter((event) => !event.type && Number.isInteger(event.step));
  const testSteps = events.filter((event) => event.type === "test_md_step_end");
  const completedSteps = progress.length > 0 ? progress : testSteps;
  const failures = meaningfulEvents(events.filter((event) => {
    return event.type === "error" || normalizeVerificationStatus(event.status) === "FAIL";
  }));
  const actions = meaningfulEvents(completedSteps.filter((event) => normalizeVerificationStatus(event.status) === "PASS"))
    .map((event) => event.text)
    .filter(Boolean)
    .filter((text, index, values) => values.indexOf(text) === index)
    .slice(-4);
  return {
    stepsTaken: completedSteps.length,
    actions,
    failures,
  };
}

function evidenceHint(stderr) {
  const match = String(stderr ?? "").match(/evidence:\s*view locally with `kane-cli evidence serve ([^`]+)`/i);
  return match ? { available: true, packPath: match[1] } : { available: false, packPath: null };
}

function mapCriteria(criteria, overall, steps = [], events = [], terminal = null) {
  const starts = events.filter((event) => event.type === "test_md_step_start");
  const ends = events.filter((event) => event.type === "test_md_step_end");

  return criteria.map((criterion) => {
    const markdownStep = steps.find((item) => item.description.includes(criterion.id));
    const start = starts.find((event) => eventText(event).includes(criterion.id));
    const explicitEnd = ends.find((event) => eventText(event).includes(criterion.id));
    const startIndex = start?.step_index ?? start?.stepIndex;
    const rootStep = explicitEnd ?? (startIndex == null ? null : ends.find((event) => {
      return (event.step_index ?? event.stepIndex) === startIndex;
    }));
    let status = "UNVERIFIED";
    if (rootStep) {
      const normalized = normalizeVerificationStatus(rootStep.status);
      if (normalized === "PASS") status = "PASS";
      else if (normalized === "FAIL" && overall !== "VERIFIER_ERROR") status = "FAIL";
    } else if (markdownStep?.marker === "✓") status = "PASS";
    else if (markdownStep?.marker === "✗" && overall !== "VERIFIER_ERROR") status = "FAIL";
    return {
      ...criterion,
      status,
      observed: rootStep ? eventText(rootStep) || null : markdownStep?.description ?? null,
      evidence: rootStep ? {
        step: rootStep.step_index ?? rootStep.stepIndex ?? null,
        eventId: rootStep.id ?? null,
        screenshot: rootStep.screenshot ?? rootStep.screenshot_path ?? terminal?.screenshot_path ?? null,
      } : null,
    };
  });
}

export function parseKaneResult({ stdout, stderr, exitCode, timedOut = false, cancelled = false, error: processError = null, resultMarkdownPath, criteria = [], requireTestMd = false }) {
  const events = parseJsonLines(stdout);
  const markdown = readResultMarkdown(resultMarkdownPath);
  const bugVerdict = bugVerdictFromEvents(events);
  const eventStatus = statusFromEvents(events, { exitCode, timedOut, cancelled, requireTestMd });
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
  const execution = summarizeExecution(events);
  const evidence = { ...evidenceHint(stderr), screenshotPath: terminal?.screenshot_path ?? null };
  return {
    status: normalizedStatus,
    exitCode,
    cancelled,
    sessionId,
    criteria: mapCriteria(criteria, normalizedStatus, currentMarkdown?.steps ?? [], events, terminal),
    events: redactValue(events),
    summary: terminal?.summary || bugVerdict?.root_cause || bugVerdict?.one_liner || null,
    oneLiner: terminal?.one_liner || bugVerdict?.one_liner || null,
    reason: terminal?.reason ?? summary?.overall_status ?? null,
    finalState: redactValue(terminal?.final_state ?? null),
    credits: terminal?.credits_consumed ?? terminal?.credits ?? null,
    duration: terminal?.duration ?? summary?.duration_s ?? null,
    testUrl: terminal?.test_url ?? null,
    finalUrl: terminal?.final_url ?? terminal?.url ?? null,
    screenshotPath: terminal?.screenshot_path ?? null,
    bugVerdict: redactValue(bugVerdict),
    stepsTaken: execution.stepsTaken,
    actions: execution.actions,
    failures: execution.failures,
    evidence,
    error: processError ? `Kane process could not start: ${processError.message ?? processError}` : null,
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

export async function runKaneTest({ testFile, cwd, criteria = [], config = {}, evidenceDirectory, signal }) {
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
    env: { KANE_CLI_USER_AGENT: "elenchos", ...(config.env ?? {}) },
    timeoutMs: ((config.timeoutSeconds ?? 120) + 30) * 1000,
    signal,
  });
  const stem = basename(testFile).replace(/_test\.md$/i, "");
  const resultMarkdownPath = join(dirname(testFile), `output-${stem}`, "Result.md");
  const parsed = parseKaneResult({
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    cancelled: result.cancelled,
    error: result.error,
    resultMarkdownPath,
    criteria,
    requireTestMd: true,
  });
  return {
    ...parsed,
    invocation: invocation.source,
    timedOut: result.timedOut,
    cancelled: result.cancelled,
    evidencePaths: persistRawEvidence(evidenceDirectory, result.stdout, result.stderr),
  };
}
