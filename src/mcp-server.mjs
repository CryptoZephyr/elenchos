import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createVerificationContract } from "./contract.mjs";
import { detectProject, loadConfig } from "./config.mjs";
import { checkKaneReadiness } from "./kane.mjs";
import { executeRun } from "./orchestrator.mjs";
import { loadTask } from "./task.mjs";
import { readJson, redactValue, trimForLog } from "./utils.mjs";

function relativePath(root, path) {
  return relative(root, path) || ".";
}

export function repositoryPath(root, requested) {
  if (typeof requested !== "string" || !requested.trim()) {
    throw new Error("A repository-relative path is required");
  }
  const absolute = resolve(root, requested);
  const fromRoot = relative(root, absolute);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error("The requested path must stay inside the configured repository");
  }
  return absolute;
}

function safeRunId(runId) {
  if (typeof runId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(runId)) {
    throw new Error("Invalid run id");
  }
  return runId;
}

function toolResult(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function toolError(error, root) {
  let message = trimForLog(error instanceof Error ? error.message : String(error), 2000);
  const normalizedRoot = resolve(root);
  if (message.includes(normalizedRoot)) message = message.split(normalizedRoot).join("<repository>");
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

async function safeTool(root, work) {
  try {
    return toolResult(await work());
  } catch (error) {
    return toolError(error, root);
  }
}

function taskWithoutSource(task) {
  const { source, ...publicTask } = task;
  return redactValue(publicTask);
}

export async function inspectRepository(root) {
  const detected = detectProject(root);
  const kane = await checkKaneReadiness(detected.verification ?? {});
  return {
    repository: ".",
    projectType: detected.detected.projectType,
    application: {
      start: detected.application.start,
      url: detected.application.url,
      readinessTimeoutMs: detected.application.readinessTimeoutMs,
    },
    agent: {
      selected: detected.detected.agent,
      candidates: detected.detected.agentCandidates,
      needsSetup: detected.detected.needsSetup,
    },
    kane: {
      installed: kane.installed,
      ready: kane.ready,
      source: kane.source,
      action: kane.action,
    },
    configPath: ".elenchos/config.json",
  };
}

export function loadTaskSnapshot(root, taskPath) {
  const absoluteTaskPath = repositoryPath(root, taskPath);
  const task = loadTask(absoluteTaskPath);
  return {
    taskPath: relativePath(root, absoluteTaskPath),
    task: taskWithoutSource(task),
  };
}

function configForRepository(root, configPath, required = true) {
  if (!configPath && !existsSync(join(root, ".elenchos", "config.json"))) {
    if (required) throw new Error("Missing Elenchos config at .elenchos/config.json");
    return { config: { repository: ".", verification: {} }, repositoryRoot: root };
  }
  const loadedConfig = loadConfig(root, configPath);
  const repositoryRoot = repositoryPath(root, loadedConfig.repository ?? ".");
  return {
    config: { ...loadedConfig, __root: repositoryRoot },
    repositoryRoot,
  };
}

export function contractSnapshot(root, taskPath, configPath) {
  const { config, repositoryRoot } = configForRepository(root, configPath, false);
  const absoluteTaskPath = repositoryPath(repositoryRoot, taskPath);
  const task = loadTask(absoluteTaskPath);
  const configuredTestPath = task.verification?.testFile ?? config.verification?.testFile;
  if (!configuredTestPath) {
    throw new Error("The task or Elenchos config must provide verification.testFile");
  }
  const absoluteTestPath = repositoryPath(repositoryRoot, configuredTestPath);
  const contract = createVerificationContract(task, absoluteTestPath);
  return {
    taskPath: relativePath(repositoryRoot, absoluteTaskPath),
    testFile: relativePath(repositoryRoot, absoluteTestPath),
    taskHash: contract.taskHash,
    taskSourceHash: contract.taskSourceHash,
    testHash: contract.testHash,
  };
}

function criterionSnapshot(criterion) {
  return {
    id: criterion.id,
    description: criterion.description,
    status: criterion.status,
    observed: criterion.observed ? trimForLog(criterion.observed, 1000) : null,
    evidence: criterion.evidence ? {
      step: criterion.evidence.step ?? null,
      eventId: criterion.evidence.eventId ?? null,
    } : null,
  };
}

function verificationSnapshot(verification) {
  return {
    status: verification.status,
    stepsTaken: verification.stepsTaken ?? null,
    duration: verification.duration ?? null,
    summary: verification.summary ? trimForLog(verification.summary, 2000) : null,
    oneLiner: verification.oneLiner ? trimForLog(verification.oneLiner, 2000) : null,
    reason: verification.reason ?? null,
    credits: verification.credits ?? null,
    testUrl: verification.testUrl ?? null,
    finalUrl: verification.finalUrl ?? null,
    evidenceAvailable: Boolean(verification.evidence?.available),
    screenshotCaptured: Boolean(verification.screenshotPath || verification.evidence?.screenshotPath),
    criteria: (verification.criteria ?? []).map(criterionSnapshot),
    failures: (verification.failures ?? [])
      .filter((failure) => failure?.text)
      .map((failure) => ({
        step: failure.step ?? null,
        text: trimForLog(failure.text, 1000),
      })),
  };
}

export function runSnapshot(run) {
  return {
    id: run.id,
    taskId: run.taskId,
    taskTitle: run.task?.title ?? null,
    agent: run.agent,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    attempts: (run.attempts ?? []).map((attempt) => ({
      number: attempt.number,
      at: attempt.at,
      verification: verificationSnapshot(attempt.verification ?? {}),
    })),
    repairs: (run.repairs ?? []).map((repair) => ({
      attempt: repair.attempt,
      at: repair.at,
      provider: repair.provider ?? null,
    })),
    verifiedRevision: run.verifiedRevision ? {
      head: run.verifiedRevision.head,
      diffHash: run.verifiedRevision.diffHash,
      changedFiles: run.verifiedRevision.changedFiles,
    } : null,
    repository: run.repository ? {
      kind: run.repository.kind,
      cleanedUp: Boolean(run.repository.cleanedUp),
    } : null,
    error: run.error ? trimForLog(run.error, 2000) : null,
    cleanupError: run.cleanupError ? trimForLog(run.cleanupError, 2000) : null,
  };
}

export function readRunSnapshot(root, runId) {
  const safeId = safeRunId(runId);
  const path = join(root, ".elenchos", "runs", safeId, "run.json");
  if (!existsSync(path)) throw new Error(`Run not found: ${safeId}`);
  return runSnapshot(readJson(path));
}

async function verifyTask(root, taskPath, configPath, signal) {
  const { config, repositoryRoot } = configForRepository(root, configPath);
  const task = loadTask(repositoryPath(repositoryRoot, taskPath));
  const result = await executeRun({
    task,
    config,
    cwd: repositoryRoot,
    mode: "verify",
    signal,
  });
  return runSnapshot(result.run);
}

export function createElenchosMcpServer({ root }) {
  const repositoryRoot = resolve(root);
  const server = new McpServer({
    name: "elenchos",
    version: "0.1.2",
  });

  server.registerTool(
    "elenchos_inspect",
    {
      title: "Inspect Elenchos readiness",
      description: "Inspect the current repository, application candidates, coding-agent candidates, and Kane readiness. This tool does not write files.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => safeTool(repositoryRoot, () => inspectRepository(repositoryRoot)),
  );

  server.registerTool(
    "elenchos_load_task",
    {
      title: "Load an Elenchos task",
      description: "Load and normalize a repository-local task JSON file without exposing its absolute source path.",
      inputSchema: {
        taskPath: z.string().min(1).describe("Task JSON path relative to the configured repository"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ taskPath }) => safeTool(repositoryRoot, () => loadTaskSnapshot(repositoryRoot, taskPath)),
  );

  server.registerTool(
    "elenchos_contract",
    {
      title: "Inspect a verification contract",
      description: "Return the task and Kane test hashes for a repository-local verification contract. This tool does not run Kane.",
      inputSchema: {
        taskPath: z.string().min(1).describe("Task JSON path relative to the configured repository"),
        configPath: z.string().optional().describe("Optional Elenchos config path relative to the configured repository"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ taskPath, configPath }) => safeTool(repositoryRoot, () => contractSnapshot(repositoryRoot, taskPath, configPath)),
  );

  server.registerTool(
    "elenchos_status",
    {
      title: "Read an Elenchos run",
      description: "Read a sanitized Elenchos run summary. Raw Kane output, local evidence paths, and credential-bearing data are omitted.",
      inputSchema: {
        runId: z.string().min(1).describe("Run ID returned by Elenchos"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ runId }) => safeTool(repositoryRoot, () => readRunSnapshot(repositoryRoot, runId)),
  );

  server.registerTool(
    "elenchos_verify",
    {
      title: "Verify a task with Kane",
      description: "Run Kane against the current implementation through Elenchos verify mode. This can start the application, consume Kane credits, and write local run evidence, but it does not invoke a coding agent or edit source files.",
      inputSchema: {
        taskPath: z.string().min(1).describe("Task JSON path relative to the configured repository"),
        configPath: z.string().optional().describe("Optional Elenchos config path relative to the configured repository"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ taskPath, configPath }, extra) => safeTool(repositoryRoot, () => verifyTask(repositoryRoot, taskPath, configPath, extra.signal)),
  );

  return server;
}

export async function startMcpServer({ root }) {
  const server = createElenchosMcpServer({ root });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}
