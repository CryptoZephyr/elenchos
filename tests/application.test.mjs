import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApplication, validateApplicationUrl } from "../src/application.mjs";
import { runCommand } from "../src/process.mjs";

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("starts an application, waits for readiness, stops it, and redacts logs", async () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-app-"));
  const script = join(root, "server.mjs");
  writeFileSync(script, [
    "import { createServer } from 'node:http';",
    "const server = createServer((request, response) => { response.writeHead(200); response.end('ok'); });",
    "server.listen(0, '127.0.0.1', () => {",
    "  const port = server.address().port;",
    "  process.stdout.write(`token=visible\\nPORT=${port}\\n`);",
    "});",
  ].join("\n"), "utf8");

  const probe = await runCommand({ command: process.execPath, args: ["-e", "process.stdout.write('ready')"] });
  assert.equal(probe.stdout, "ready");

  let app;
  try {
    const port = await availablePort();
    writeFileSync(script, readFileSync(script, "utf8").replace("server.listen(0", `server.listen(${port}`), "utf8");
    app = await startApplication({
      config: { start: [process.execPath, script], url: `http://127.0.0.1:${port}`, readinessTimeoutMs: 5000 },
      cwd: root,
      logDirectory: join(root, "logs"),
    });
    await app.stop();
    app = null;
    assert.match(readFileSync(join(root, "logs", "application.stdout.log"), "utf8"), /token=\[REDACTED\]/);
  } finally {
    if (app) await app.stop();
    rmSync(root, { recursive: true, force: true });
  }
});

test("reports a process that exits before application readiness", async () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-app-fail-"));
  try {
    await assert.rejects(() => startApplication({
      config: { start: [process.execPath, "-e", "process.exit(2)"], url: "http://127.0.0.1:39999", readinessTimeoutMs: 1000 },
      cwd: root,
      logDirectory: join(root, "logs"),
    }), /Application exited with code 2/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("terminates a command after its timeout", async () => {
  const result = await runCommand({
    command: process.execPath,
    args: ["-e", "setInterval(() => {}, 1000)"],
    timeoutMs: 50,
  });
  assert.equal(result.timedOut, true);
});

test("terminates descendant processes on POSIX", async () => {
  if (process.platform === "win32") return;
  const root = mkdtempSync(join(tmpdir(), "elenchos-process-group-"));
  const pidFile = join(root, "child.pid");
  const script = [
    "import { writeFileSync } from 'node:fs';",
    "import { spawn } from 'node:child_process';",
    "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
    `writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));`,
    "setInterval(() => {}, 1000);",
  ].join("\n");
  try {
    const result = await runCommand({ command: process.execPath, args: ["--input-type=module", "-e", script], timeoutMs: 100 });
    assert.equal(result.timedOut, true);
    let childPid = null;
    for (let attempt = 0; attempt < 10 && !childPid; attempt += 1) {
      if (existsSync(pidFile)) childPid = Number(readFileSync(pidFile, "utf8"));
      if (!childPid) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(childPid);
    let alive = true;
    for (let attempt = 0; attempt < 10 && alive; attempt += 1) {
      try { process.kill(childPid, 0); } catch { alive = false; }
      if (alive) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(alive, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("cancels a running command through AbortSignal", async () => {
  const controller = new AbortController();
  const resultPromise = runCommand({
    command: process.execPath,
    args: ["-e", "setInterval(() => {}, 1000)"],
    timeoutMs: 5000,
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 50);
  const result = await resultPromise;
  assert.equal(result.cancelled, true);
  assert.equal(result.timedOut, false);
});

test("requires loopback application URLs unless remote access is explicit", () => {
  assert.equal(validateApplicationUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
  assert.equal(validateApplicationUrl("http://[::1]:3000"), "http://[::1]:3000");
  assert.throws(() => validateApplicationUrl("https://example.com"), /loopback address/);
  assert.equal(validateApplicationUrl("https://example.com", { allowRemoteUrl: true }), "https://example.com");
  assert.throws(() => validateApplicationUrl("http://user:password@example.com"), /embedded credentials/);
});

test("does not execute shell metacharacters in Windows npm arguments", async () => {
  if (process.platform !== "win32") return;
  const marker = "ELENCHOS_SHELL_INJECTION_MARKER";
  const result = await runCommand({
    command: "npm",
    args: [`--version & echo ${marker}`],
    timeoutMs: 10000,
  });
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(marker));
});
