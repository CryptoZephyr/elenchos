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

function isLoopback(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "::1" || /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(normalized);
}

export function validateApplicationUrl(value, { allowRemoteUrl = false } = {}) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("application.url must be a valid http or https URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("application.url must use http or https without embedded credentials");
  }
  if (!allowRemoteUrl && !isLoopback(parsed.hostname)) {
    throw new Error("application.url must point to localhost or a loopback address unless application.allowRemoteUrl is true");
  }
  return String(value);
}

function waitForInterval(ms, signal) {
  return new Promise((resolvePromise) => {
    let timer;
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      resolvePromise();
    };
    timer = setTimeout(() => {
      cleanup();
      resolvePromise();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitForReady(url, timeoutMs, child, signal) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "No response yet";
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error("Application startup cancelled");
    if (child.exitCode !== null) throw new Error(`Application exited with code ${child.exitCode}`);
    try {
      const response = await fetch(url, { redirect: "error" });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await waitForInterval(250, signal);
  }
  if (signal?.aborted) throw new Error("Application startup cancelled");
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

export async function startApplication({ config, cwd, logDirectory, signal }) {
  if (!config?.start) throw new Error("Application start command is not configured. Run elenchos init with --start <command>.");
  if (!config?.url) throw new Error("Application URL is not configured. Run elenchos init with --url <url>.");
  validateApplicationUrl(config.url, { allowRemoteUrl: config.allowRemoteUrl === true });
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
    await waitForReady(config.url, config.readinessTimeoutMs ?? 60000, managed.child, signal);
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
