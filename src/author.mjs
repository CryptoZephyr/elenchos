import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { locateKaneInvocation, parseJsonLines } from "./kane.mjs";
import { runCommand } from "./process.mjs";
import { createId, redactValue, repositoryPath, trimForLog } from "./utils.mjs";

function promptForTask(task) {
  const { source, ...promptTask } = task;
  return [
    "Create a functional browser verification test for the task below.",
    "Use every acceptance criterion id in the matching test case or step heading.",
    "Cover the stated setup and preconditions when they affect the user flow.",
    "Keep the test focused on observable behavior and do not weaken or rewrite any criterion.",
    "Return runnable Functional cases suitable for kane-cli testmd run.",
    "",
    JSON.stringify(promptTask, null, 2),
  ].join("\n");
}

function findTestFiles(root) {
  if (!existsSync(root)) return [];
  const found = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) found.push(...findTestFiles(path));
    else if (entry.isFile() && /_test\.md$/i.test(entry.name)) found.push(path);
  }
  return found;
}

function terminalEvent(events) {
  return [...events].reverse().find((event) => event.type === "generate_done") ?? null;
}

function snapshotEvent(events) {
  return [...events].reverse().find((event) => event.type === "generate_snapshot") ?? null;
}

function clarificationEvent(events) {
  return [...events].reverse().find((event) => event.type === "generate_clarification") ?? null;
}

function saveEvent(events) {
  return [...events].reverse().find((event) => event.type === "generate_save_result") ?? null;
}

export function parseKaneGenerateResult({ stdout, stderr, exitCode, cancelled = false, error: processError = null }) {
  const events = parseJsonLines(stdout);
  const terminal = terminalEvent(events);
  const snapshot = snapshotEvent(events);
  const clarification = clarificationEvent(events);
  const saved = saveEvent(events);
  let status = "FAILED";
  if (cancelled || exitCode === 3 || exitCode === 130 || terminal?.status === "stopped") status = "CANCELLED";
  else if (clarification) status = "CLARIFICATION";
  else if (exitCode === 0 && terminal?.status === "completed") status = "COMPLETED";
  const requestId = terminal?.request_id
    ?? events.find((event) => event.type === "generate_start")?.request_id
    ?? null;
  return {
    status,
    exitCode,
    cancelled,
    requestId,
    scenarios: snapshot?.scenarios ?? [],
    scenarioCount: snapshot?.scenario_count ?? 0,
    caseCount: snapshot?.case_count ?? 0,
    clarification: clarification?.text ?? null,
    saved: saved?.saved ?? [],
    suiteDirectory: terminal?.suite_dir ?? saved?.suite_dir ?? null,
    error: events.find((event) => event.type === "error")?.message
      ?? (processError ? `Kane process could not start: ${processError.message ?? processError}` : null),
    events: redactValue(events),
    rawEvidence: {
      stdout: trimForLog(stdout),
      stderr: trimForLog(stderr),
    },
  };
}

function savedPaths(result, generatedRoot, cwd) {
  const reported = Array.isArray(result.saved) ? result.saved : [];
  const paths = reported
    .map((value) => typeof value === "string" ? value : value?.path ?? value?.file)
    .filter(Boolean)
    .map((value) => {
      try {
        const candidate = repositoryPath(cwd, value);
        return repositoryPath(generatedRoot, relative(generatedRoot, candidate));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const discovered = findTestFiles(generatedRoot);
  return [...new Set([...paths, ...discovered].filter((path) => existsSync(path)))];
}

export async function authorKaneTest({ task, cwd, outputPath, force = false, config = {}, signal, refine = null, requestId = null }) {
  const target = repositoryPath(cwd, outputPath);
  if (!/_test\.md$/i.test(target)) throw new Error("The Kane output path must end with _test.md");
  if (existsSync(target) && !force) throw new Error(`Kane test already exists at ${target}. Use --force to replace it.`);
  if (refine && !requestId) throw new Error("--refine requires --request-id from an earlier Kane authoring result");
  if (requestId && !refine) throw new Error("--request-id requires --refine");

  const invocation = locateKaneInvocation(config);
  const generatedRoot = repositoryPath(cwd, join(".testmuai", "elenchos-authoring", createId("generate")));
  mkdirSync(generatedRoot, { recursive: true });
  const timeoutMs = config.authoringTimeoutMs ?? 180000;
  const environment = { KANE_CLI_USER_AGENT: "elenchos", ...(config.env ?? {}) };
  const generationArgs = refine
    ? [...invocation.prefixArgs, "generate", refine, "--refine", "--req", String(requestId), "--agent"]
    : [...invocation.prefixArgs, "generate", promptForTask(task), "--agent"];
  const generated = await runCommand({
    command: invocation.command,
    args: generationArgs,
    cwd,
    env: environment,
    timeoutMs,
    signal,
  });
  const first = parseKaneGenerateResult(generated);
  if (first.status !== "COMPLETED") return { ...first, invocation: invocation.source };
  const authoringRequestId = first.requestId ?? requestId;
  if (!authoringRequestId) return { ...first, status: "FAILED", error: "Kane did not return an authoring request id", invocation: invocation.source };

  const saved = await runCommand({
    command: invocation.command,
    args: [...invocation.prefixArgs, "generate", "--save", "--req", String(authoringRequestId), "--out", generatedRoot, "--agent"],
    cwd,
    env: environment,
    timeoutMs,
    signal,
  });
  const second = parseKaneGenerateResult(saved);
  if (second.status !== "COMPLETED") {
    return {
      ...second,
      requestId: second.requestId ?? authoringRequestId,
      scenarios: first.scenarios,
      scenarioCount: first.scenarioCount,
      caseCount: first.caseCount,
      invocation: invocation.source,
    };
  }

  const generatedFiles = savedPaths(second, generatedRoot, cwd);
  if (generatedFiles.length !== 1) {
    return {
      ...second,
      requestId: second.requestId ?? authoringRequestId,
      scenarios: first.scenarios,
      scenarioCount: first.scenarioCount,
      caseCount: first.caseCount,
      status: "FAILED",
      error: generatedFiles.length === 0
        ? "Kane completed authoring but saved no Functional _test.md file"
        : `Kane saved ${generatedFiles.length} Functional _test.md files. Select one before adding it to the verification contract.`,
      generatedFiles: generatedFiles.map((path) => relative(cwd, path)),
      invocation: invocation.source,
    };
  }

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(generatedFiles[0], target);
  return {
    ...second,
    requestId: second.requestId ?? authoringRequestId,
    scenarios: first.scenarios,
    scenarioCount: first.scenarioCount,
    caseCount: first.caseCount,
    outputPath: target,
    generatedFile: relative(cwd, generatedFiles[0]),
    invocation: invocation.source,
  };
}

export function formatAuthorSummary(result) {
  const lines = [`Kane authoring: ${result.status}`];
  if (result.requestId) lines.push(`Request: ${result.requestId}`);
  if (result.scenarioCount || result.caseCount) lines.push(`Generated: ${result.scenarioCount} scenarios, ${result.caseCount} cases`);
  if (result.outputPath) lines.push(`Saved test: ${result.outputPath}`);
  if (result.generatedFiles?.length) lines.push(`Generated files: ${result.generatedFiles.join(", ")}`);
  if (result.clarification) lines.push(`Kane needs clarification: ${result.clarification}`);
  if (result.clarification && result.requestId) lines.push(`Continue with --refine <answer> --request-id ${result.requestId}`);
  if (result.error) lines.push(`Error: ${result.error}`);
  return lines.join("\n");
}
