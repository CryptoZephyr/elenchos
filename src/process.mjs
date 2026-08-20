import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { dirname, join } from "node:path";

function npmInvocation() {
  if (process.platform !== "win32") return { command: "npm", args: [] };
  const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (existsSync(npmCli)) return { command: process.execPath, args: [npmCli] };
  return { command: "npm.cmd", args: [] };
}

function normalizeWindowsCommand(command, args) {
  if (process.platform !== "win32") return { command, args, shell: false };
  if (["npm", "npx", "pnpm", "yarn"].includes(command.toLowerCase())) {
    return { command: `${command}.cmd`, args, shell: true };
  }
  if (/\.ps1$/i.test(command)) {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", command, ...args],
      shell: false,
    };
  }
  return { command, args, shell: /\.(cmd|bat)$/i.test(command) };
}

export function commandExists(command) {
  const lookup = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(lookup, [command], { stdio: "ignore", windowsHide: true });
  return result.status === 0;
}

export function globalNpmRoot() {
  const npm = npmInvocation();
  const result = spawnSync(npm.command, [...npm.args, "root", "-g"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function terminateProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try { child.kill("SIGTERM"); } catch { /* The process may already be gone. */ }
}

export function spawnManaged({ command, args = [], cwd, env, stdoutPath, stderrPath }) {
  const normalized = normalizeWindowsCommand(command, args);
  const child = spawn(normalized.command, normalized.args, {
    cwd,
    env: { ...process.env, ...env },
    shell: normalized.shell,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stdoutStream = stdoutPath ? createWriteStream(stdoutPath, { flags: "a" }) : null;
  const stderrStream = stderrPath ? createWriteStream(stderrPath, { flags: "a" }) : null;
  if (stdoutStream) child.stdout.pipe(stdoutStream);
  if (stderrStream) child.stderr.pipe(stderrStream);

  return { child, stdoutStream, stderrStream };
}

export function runCommand({ command, args = [], cwd, env, timeoutMs = 120000, input, signal }) {
  return new Promise((resolve) => {
    const normalized = normalizeWindowsCommand(command, args);
    const child = spawn(normalized.command, normalized.args, {
      cwd,
      env: { ...process.env, ...env },
      shell: normalized.shell,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let cancelled = false;
    let timer;
    let forceTimer;

    const abort = () => {
      if (settled) return;
      cancelled = true;
      terminateProcessTree(child);
      forceTimer = setTimeout(() => finish({ exitCode: null, signal: "CANCELLED" }), 2500);
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceTimer);
      signal?.removeEventListener("abort", abort);
      resolve({ ...result, stdout, stderr, timedOut, cancelled });
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => finish({ exitCode: null, signal: null, error }));
    child.on("close", (exitCode, signal) => finish({ exitCode, signal }));

    timer = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
      forceTimer = setTimeout(() => finish({ exitCode: null, signal: "TIMEOUT" }), 2500);
    }, timeoutMs);

    if (signal) {
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }

    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

export async function stopManagedProcess(managed) {
  if (!managed?.child || managed.child.exitCode !== null) return;
  const child = managed.child;
  terminateProcessTree(child);
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2000);
    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  if (process.platform === "win32" && child.exitCode === null) {
    terminateProcessTree(child);
  }
}
