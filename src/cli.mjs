#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initProject, loadConfig } from "./config.mjs";
import { loadTask } from "./task.mjs";
import { executeRun } from "./orchestrator.mjs";
import { printRunSummary } from "./report.mjs";
import { readJson } from "./utils.mjs";

function usage() {
  return `Elenchos - independent verification for AI coding agents

Usage:
  elenchos init [--force]
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

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const { positional, flags } = parseFlags(rest);
  const cwd = resolve(flags.repo ?? process.cwd());

  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(usage());
    return;
  }

  if (command === "init") {
    const result = await initProject(cwd, { force: Boolean(flags.force) });
    process.stdout.write(`Wrote ${result.path}\n`);
    process.stdout.write(`Detected agent: ${result.config.detected.agent}\n`);
    process.stdout.write(`Detected Kane: ${result.config.detected.kane}\n`);
    process.stdout.write(`Kane readiness: ${result.config.detected.kaneReady ? "authenticated" : "needs setup"}\n`);
    if (result.config.detected.kaneAction) process.stdout.write(`Next step: ${result.config.detected.kaneAction}\n`);
    process.stdout.write(`Application: ${result.config.application.start ?? "not detected"}\n`);
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
  const result = await executeRun({ task, config, cwd: repositoryRoot, mode: command });
  printRunSummary(result.run, { json: Boolean(flags.json) });
  if (result.run.status !== "VERIFIED") process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`Elenchos error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
