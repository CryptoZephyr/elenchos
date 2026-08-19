import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnManaged, stopManagedProcess } from "./process.mjs";
import { redactText, shellSplit } from "./utils.mjs";

function commandParts(start) {
  if (Array.isArray(start) && start.length > 0) return { command: start[0], args: start.slice(1) };
  const parts = shellSplit(start);
  if (parts.length === 0) throw new Error("application.start is empty");
  return { command: parts[0], args: parts.slice(1) };
}

async function waitForReady(url, timeoutMs, child) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "No response yet";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Application exited with code ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Application did not become ready at ${url}: ${lastError}`);
}

function sanitizeLog(path) {
  if (!existsSync(path)) return;
  writeFileSync(path, redactText(readFileSync(path, "utf8")), "utf8");
}

function sanitizeLogs(stdoutPath, stderrPath) {
  sanitizeLog(stdoutPath);
  sanitizeLog(stderrPath);
}

export async function startApplication({ config, cwd, logDirectory }) {
  const parts = commandParts(config.start);
  mkdirSync(logDirectory, { recursive: true });
  const stdoutPath = resolve(logDirectory, "application.stdout.log");
  const stderrPath = resolve(logDirectory, "application.stderr.log");
  const managed = spawnManaged({
    ...parts,
    cwd,
    env: config.env ?? {},
    stdoutPath,
    stderrPath,
  });
  managed.child.on("error", (error) => {
    appendFileSync(stderrPath, `${error.stack ?? error}\n`, "utf8");
  });
  try {
    await waitForReady(config.url, config.readinessTimeoutMs ?? 60000, managed.child);
  } catch (error) {
    await stopManagedProcess(managed);
    sanitizeLogs(stdoutPath, stderrPath);
    throw new Error(`${error.message}. See ${stderrPath}`);
  }
  const stop = async () => {
    await stopManagedProcess(managed);
    sanitizeLogs(stdoutPath, stderrPath);
  };
  return {
    url: config.url,
    pid: managed.child.pid,
    stdoutPath,
    stderrPath,
    stop,
  };
}
