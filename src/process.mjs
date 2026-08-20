import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

function npmInvocation() {
  if (process.platform !== "win32") return { command: "npm", args: [] };
  const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (existsSync(npmCli)) return { command: process.execPath, args: [npmCli] };
  return { command: "npm", args: [] };
}

function windowsCommandPath(command) {
  const value = String(command);
  let candidates = [];
  if (isAbsolute(value) || /[\\/]/.test(value)) {
    if (existsSync(value)) candidates.push(value);
  } else {
    const result = spawnSync("where.exe", [value], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status === 0) {
      candidates = result.stdout.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
    }
  }
  if (candidates.length === 0) return value;
  const first = candidates[0];
  if (/\.(?:exe|com|ps1)$/i.test(first)) return first;
  const base = first.replace(/\.(?:cmd|bat)$/i, "");
  const powershellShim = `${base}.ps1`;
  return existsSync(powershellShim) ? powershellShim : first;
}

function normalizeWindowsCommand(command, args) {
  if (process.platform !== "win32") return { command, args, shell: false };
  const lowerCommand = String(command).toLowerCase();
  if (["npm", "npx"].includes(lowerCommand)) {
    const cliName = lowerCommand === "npm" ? "npm-cli.js" : "npx-cli.js";
    const cliPath = join(dirname(process.execPath), "node_modules", "npm", "bin", cliName);
    if (!existsSync(cliPath)) throw new Error(`Cannot safely run ${command} because its Node CLI entrypoint was not found`);
    return { command: process.execPath, args: [cliPath, ...args], shell: false };
  }
  const resolvedCommand = windowsCommandPath(command);
  if (/\.(cmd|bat)$/i.test(resolvedCommand)) {
    throw new Error(`Refusing to run Windows wrapper ${resolvedCommand} with shell execution`);
  }
  if (/\.ps1$/i.test(resolvedCommand)) {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolvedCommand, ...args],
      shell: false,
    };
  }
  return { command: resolvedCommand, args, shell: false };
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

function terminateProcessTree(child, signal = "SIGTERM") {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try { process.kill(-child.pid, signal); } catch {
    try { child.kill(signal); } catch { /* The process may already be gone. */ }
  }
}

export function spawnManaged({ command, args = [], cwd, env, stdoutPath, stderrPath }) {
  const normalized = normalizeWindowsCommand(command, args);
  const child = spawn(normalized.command, normalized.args, {
    cwd,
    env: { ...process.env, ...env },
    shell: normalized.shell,
    detached: process.platform !== "win32",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stdoutStream = stdoutPath ? createWriteStream(stdoutPath, { flags: "a" }) : null;
  const stderrStream = stderrPath ? createWriteStream(stderrPath, { flags: "a" }) : null;
  if (stdoutStream) child.stdout.pipe(stdoutStream);
  if (stderrStream) child.stderr.pipe(stderrStream);

  return { child, stdoutStream, stderrStream };
}

export function runCommand({ command, args = [], cwd, env, timeoutMs = 120000, input, signal, maxOutputBytes = 4 * 1024 * 1024 }) {
  return new Promise((resolve) => {
    const normalized = normalizeWindowsCommand(command, args);
    const child = spawn(normalized.command, normalized.args, {
      cwd,
      env: { ...process.env, ...env },
      shell: normalized.shell,
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    const outputLimit = Number.isSafeInteger(maxOutputBytes) && maxOutputBytes > 0 ? maxOutputBytes : 4 * 1024 * 1024;
    let capturedBytes = 0;
    let outputLimitExceeded = false;
    let settled = false;
    let timedOut = false;
    let cancelled = false;
    let timer;
    let forceTimer;

    const capture = (chunks, chunk) => {
      if (outputLimitExceeded) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = outputLimit - capturedBytes;
      if (remaining > 0) {
        const captured = buffer.subarray(0, remaining);
        chunks.push(captured);
        capturedBytes += captured.length;
      }
      if (buffer.length > remaining) {
        outputLimitExceeded = true;
        terminateProcessTree(child);
        forceTimer = setTimeout(() => {
          terminateProcessTree(child, "SIGKILL");
          finish({ exitCode: null, signal: "OUTPUT_LIMIT" });
        }, 2500);
      }
    };

    const abort = () => {
      if (settled) return;
      cancelled = true;
      terminateProcessTree(child);
      forceTimer = setTimeout(() => {
        terminateProcessTree(child, "SIGKILL");
        finish({ exitCode: null, signal: "CANCELLED" });
      }, 2500);
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceTimer);
      signal?.removeEventListener("abort", abort);
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      const outputError = outputLimitExceeded
        ? new Error(`Process output exceeded the ${outputLimit}-byte capture limit`)
        : null;
      resolve({
        ...result,
        error: result.error ?? outputError,
        stdout,
        stderr,
        timedOut,
        cancelled,
        outputLimitExceeded,
      });
    };

    child.stdout.on("data", (chunk) => capture(stdoutChunks, chunk));
    child.stderr.on("data", (chunk) => capture(stderrChunks, chunk));
    child.on("error", (error) => finish({ exitCode: null, signal: null, error }));
    child.on("close", (exitCode, signal) => finish({ exitCode, signal }));

    timer = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
      forceTimer = setTimeout(() => {
        terminateProcessTree(child, "SIGKILL");
        finish({ exitCode: null, signal: "TIMEOUT" });
      }, 2500);
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
  if (child.exitCode === null) {
    terminateProcessTree(child, "SIGKILL");
  }
}
