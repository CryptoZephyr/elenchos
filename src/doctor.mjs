import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { detectProject, loadConfig } from "./config.mjs";
import { checkKaneReadiness } from "./kane.mjs";
import { loadTask } from "./task.mjs";
import { repositoryPath, trimForLog } from "./utils.mjs";
import { VERSION } from "./version.mjs";

const MCP_VERSION = VERSION;

function relativePath(root, path) {
  return relative(root, path) || ".";
}

function safeError(error, root) {
  const message = trimForLog(error instanceof Error ? error.message : String(error), 1000);
  return message.split(resolve(root)).join("<repository>");
}

function applicationSnapshot(config) {
  return {
    start: config?.application?.start ?? null,
    url: config?.application?.url ?? null,
    readinessTimeoutMs: config?.application?.readinessTimeoutMs ?? null,
  };
}

function agentSnapshot(config) {
  return {
    provider: config?.agent?.provider ?? null,
    command: config?.agent?.command ?? null,
  };
}

export async function checkMcpReadiness(root) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("./cli.mjs", import.meta.url)), "mcp", "--repo", root],
    cwd: root,
    stderr: "pipe",
  });
  const client = new Client({ name: "elenchos-doctor", version: MCP_VERSION });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    return {
      status: "ready",
      transport: "stdio",
      toolCount: listed.tools.length,
      tools: listed.tools.map((tool) => tool.name),
    };
  } catch (error) {
    return {
      status: "error",
      transport: "stdio",
      toolCount: 0,
      tools: [],
      error: safeError(error, root),
    };
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
}

function inspectProject(root, configPath) {
  const detected = detectProject(root);
  const configuredPath = repositoryPath(root, configPath ?? ".elenchos/config.json");
  const base = {
    path: relativePath(root, configuredPath),
    projectType: detected.detected.projectType,
    detected: {
      startCandidates: detected.detected.startCandidates,
      urlCandidates: detected.detected.urlCandidates,
      agentCandidates: detected.detected.agentCandidates,
    },
  };

  if (!existsSync(configuredPath)) {
    return {
      ...base,
      status: "missing",
      repository: ".",
      application: applicationSnapshot(detected),
      agent: agentSnapshot(detected),
      missing: [relativePath(root, configuredPath)],
    };
  }

  try {
    const config = loadConfig(root, configPath);
    const repositoryRoot = repositoryPath(root, config.repository ?? ".");
    const missing = [];
    if (!config.application?.start) missing.push("application.start");
    if (!config.application?.url) missing.push("application.url");
    if (!config.agent?.provider) missing.push("agent.provider");
    return {
      ...base,
      status: missing.length ? "needs_setup" : "ready",
      repository: relativePath(root, repositoryRoot),
      application: applicationSnapshot(config),
      agent: agentSnapshot(config),
      verification: {
        timeoutSeconds: config.verification?.timeoutSeconds ?? null,
        headless: config.verification?.headless ?? null,
      },
      missing,
    };
  } catch (error) {
    return {
      ...base,
      status: "invalid",
      repository: ".",
      application: applicationSnapshot(detected),
      agent: agentSnapshot(detected),
      missing: ["valid .elenchos/config.json"],
      error: safeError(error, root),
    };
  }
}

function taskWithoutSource(task) {
  const { source, ...publicTask } = task;
  return publicTask;
}

function inspectTask(root, projectRoot, taskPath, config = {}) {
  if (!taskPath) {
    return {
      status: "not_checked",
      path: null,
      testFile: null,
      missing: [],
      action: "Pass a task JSON path to check its Kane test file",
    };
  }

  let absoluteTaskPath;
  try {
    absoluteTaskPath = repositoryPath(projectRoot, taskPath);
  } catch (error) {
    return {
      status: "invalid",
      path: taskPath,
      testFile: null,
      missing: [],
      error: safeError(error, root),
    };
  }

  if (!existsSync(absoluteTaskPath)) {
    return {
      status: "missing",
      path: taskPath,
      testFile: null,
      missing: [taskPath],
    };
  }

  try {
    const task = loadTask(absoluteTaskPath);
    const testFile = task.verification?.testFile ?? config.verification?.testFile ?? null;
    const result = {
      status: "ready",
      path: relativePath(projectRoot, absoluteTaskPath),
      testFile,
      task: {
        id: task.id,
        title: task.title,
        acceptanceCriteria: task.acceptanceCriteria?.length ?? 0,
      },
      missing: [],
    };
    if (!testFile) {
      result.status = "needs_setup";
      result.missing.push("verification.testFile");
      return result;
    }
    const absoluteTestPath = repositoryPath(projectRoot, testFile);
    if (!existsSync(absoluteTestPath)) {
      result.status = "missing";
      result.missing.push(relativePath(projectRoot, absoluteTestPath));
    } else {
      result.testFile = relativePath(projectRoot, absoluteTestPath);
    }
    result.task = taskWithoutSource(task);
    return result;
  } catch (error) {
    return {
      status: "invalid",
      path: relativePath(projectRoot, absoluteTaskPath),
      testFile: null,
      missing: [],
      error: safeError(error, root),
    };
  }
}

function nextSteps(report) {
  const steps = [];
  if (report.mcp.status !== "ready") steps.push("Reconnect or reinstall the local MCP server");
  if (report.project.status !== "ready") steps.push("Run: npx elenchos init, then resolve the reported project choices");
  if (!report.kane.installed) steps.push("Install Kane with: npm install -g @testmuai/kane-cli");
  else if (!report.kane.identity.authenticated) steps.push("Authenticate Kane with: kane-cli login");
  if (report.kane.balance.status !== "available") steps.push("Confirm Kane credits with: kane-cli balance");
  if (report.task.status === "not_checked") steps.push("Pass a task JSON path to doctor to check the Kane test file");
  else if (report.task.status !== "ready") steps.push("Create or select the reported task and Kane test file");
  return steps;
}

export async function createDoctorReport(root, {
  configPath,
  taskPath,
  checkKane = checkKaneReadiness,
  checkMcp = checkMcpReadiness,
} = {}) {
  const project = inspectProject(root, configPath);
  const projectRoot = repositoryPath(root, project.repository ?? ".");
  const [mcp, kane] = await Promise.all([
    checkMcp(root),
    checkKane(project.verification ?? {}),
  ]);
  const config = project.status === "ready" || project.status === "needs_setup"
    ? (() => {
      try { return loadConfig(root, configPath); } catch { return {}; }
    })()
    : {};
  const task = inspectTask(root, projectRoot, taskPath, config);
  const basicReady = mcp.status === "ready";
  const verificationReady = kane.ready && project.status === "ready" && task.status === "ready";
  const report = {
    status: basicReady ? "ready" : "needs_setup",
    basic: { status: basicReady ? "ready" : "needs_setup" },
    verification: { status: verificationReady ? "ready" : "needs_setup" },
    mcp,
    project,
    kane,
    task,
  };
  report.nextSteps = nextSteps(report);
  return report;
}

function display(value, fallback = "unknown") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

export function formatDoctorReport(report) {
  const lines = [
    `Elenchos doctor: ${String(report.status).toUpperCase()}`,
    `Basic MCP setup: ${report.basic.status}`,
    `MCP server: ${report.mcp.status} (${display(report.mcp.toolCount, "0")} tools, ${display(report.mcp.transport)})`,
    `Project config: ${report.project.status} (${display(report.project.projectType)})`,
    `Kane CLI: ${report.kane.installed ? "installed" : "not installed"} (${display(report.kane.source)})`,
    `Kane authentication: ${display(report.kane.identity?.status)}`,
    `Kane credits: ${report.kane.balance?.status ?? "unknown"} (${display(report.kane.balance?.available)})`,
    `Verification setup: ${report.verification.status}`,
    `Task: ${report.task.status}${report.task.path ? ` (${report.task.path})` : ""}`,
  ];
  if (report.task.testFile) lines.push(`Kane test: ${report.task.testFile}`);
  if (report.nextSteps.length) {
    lines.push("Next steps:");
    for (const step of report.nextSteps) lines.push(`- ${step}`);
  }
  return lines.join("\n");
}
