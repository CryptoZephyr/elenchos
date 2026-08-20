#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initProject, loadConfig } from "./config.mjs";
import { loadTask } from "./task.mjs";
import { executeRun } from "./orchestrator.mjs";
import { printRunSummary } from "./report.mjs";
import { readJson } from "./utils.mjs";
import { authorKaneTest, formatAuthorSummary } from "./author.mjs";
import { startMcpServer } from "./mcp-server.mjs";
import { createDoctorReport, formatDoctorReport } from "./doctor.mjs";

function usage() {
  return `Elenchos - independent verification for AI coding agents

Usage:
  elenchos init [--force] [--start <command>] [--url <url>] [--agent <agy|claude|gemini|codex>]
  elenchos doctor [task.json] [--repo <path>] [--config <path>] [--json] [--strict]
  elenchos mcp [--repo <path>]
  elenchos author <task.json> [--output <path>] [--refine <answer> --request-id <id>] [--force] [--json]
  elenchos run <task.json> [--json]
  elenchos verify <task.json> [--json]
  elenchos status <run-id> [--json]
`;
}

function parseFlags(values) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const [key, inline] = value.slice(2).split("=", 2);
    if (inline !== undefined) flags[key] = inline;
    else if (values[index + 1] && !values[index + 1].startsWith("--")) flags[key] = values[++index];
    else flags[key] = true;
  }
  return { positional, flags };
}

async function withAbortSignal(work) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  try {
    return await work(controller.signal);
  } finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
  }
}

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const { positional, flags } = parseFlags(rest);
  const cwd = resolve(flags.repo ?? process.cwd());

  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(usage());
    return;
  }

  if (command === "init") {
    const result = await initProject(cwd, {
      force: Boolean(flags.force),
      start: flags.start,
      url: flags.url,
      agent: flags.agent,
    });
    process.stdout.write(`Wrote ${result.path}\n`);
    process.stdout.write(`Project type: ${result.config.detected.projectType}\n`);
    process.stdout.write(`Detected agent: ${result.config.detected.agent}\n`);
    if (result.config.detected.agentCandidates?.length > 1) {
      process.stdout.write(`Agent candidates: ${result.config.detected.agentCandidates.join(", ")}\n`);
    }
    process.stdout.write(`Detected Kane: ${result.config.detected.kane}\n`);
    process.stdout.write(`Kane readiness: ${result.config.detected.kaneReady ? "authenticated" : "needs setup"}\n`);
    if (result.config.detected.kaneAction) process.stdout.write(`Next step: ${result.config.detected.kaneAction}\n`);
    process.stdout.write(`Application: ${result.config.application.start ?? "not detected"}\n`);
    process.stdout.write(`URL: ${result.config.application.url ?? "not detected"}\n`);
    if (result.config.detected.needsSetup?.length) {
      process.stdout.write(`Setup needed: ${result.config.detected.needsSetup.join(", ")}\n`);
      process.stdout.write("Pass --start, --url, or --agent to resolve detected choices, then rerun init --force.\n");
    }
    return;
  }

  if (command === "mcp") {
    await startMcpServer({ root: cwd });
    return;
  }

  if (command === "doctor") {
    const report = await createDoctorReport(cwd, {
      configPath: flags.config,
      taskPath: positional[0],
    });
    process.stdout.write(flags.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatDoctorReport(report)}\n`);
    if (flags.strict && report.verification.status !== "ready") process.exitCode = 1;
    return;
  }

  if (command === "author") {
    const taskPath = positional[0];
    if (!taskPath) throw new Error("author requires a task JSON path");
    const loadedConfig = existsSync(resolve(cwd, flags.config ?? ".elenchos/config.json"))
      ? loadConfig(cwd, flags.config)
      : {};
    const repositoryRoot = resolve(cwd, loadedConfig.repository ?? ".");
    const task = loadTask(resolve(repositoryRoot, taskPath));
    const outputPath = flags.output ?? task.verification?.testFile ?? `tests/${task.id}_test.md`;
    const result = await withAbortSignal((signal) => authorKaneTest({
      task,
      cwd: repositoryRoot,
      outputPath,
      force: Boolean(flags.force),
      config: loadedConfig.verification ?? {},
      signal,
      refine: flags.refine === true ? null : flags.refine,
      requestId: flags["request-id"],
    }));
    process.stdout.write(flags.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatAuthorSummary(result)}\n`);
    if (result.status !== "COMPLETED") process.exitCode = 1;
    return;
  }

  if (command === "status") {
    const runId = positional[0];
    if (!runId) throw new Error("status requires a run id");
    const path = resolve(cwd, ".elenchos", "runs", runId, "run.json");
    if (!existsSync(path)) throw new Error(`Run not found: ${path}`);
    const run = readJson(path);
    printRunSummary(run, { json: Boolean(flags.json) });
    return;
  }

  if (command !== "run" && command !== "verify") throw new Error(`Unknown command: ${command}\n\n${usage()}`);
  const taskPath = positional[0];
  if (!taskPath) throw new Error(`${command} requires a task JSON path`);
  const loadedConfig = loadConfig(cwd, flags.config);
  const repositoryRoot = resolve(cwd, loadedConfig.repository ?? ".");
  const config = { ...loadedConfig, __root: repositoryRoot };
  const task = loadTask(resolve(repositoryRoot, taskPath));
  const result = await withAbortSignal((signal) => executeRun({ task, config, cwd: repositoryRoot, mode: command, signal }));
  printRunSummary(result.run, { json: Boolean(flags.json) });
  if (result.run.status !== "VERIFIED") process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`Elenchos error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
