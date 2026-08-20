import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApplication } from "../src/application.mjs";
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
