import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkMcpReadiness, createDoctorReport, formatDoctorReport } from "../src/doctor.mjs";

function writeProject(root, { config = true, testFile = true } = {}) {
  mkdirSync(join(root, ".elenchos"), { recursive: true });
  mkdirSync(join(root, "tests"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({
    scripts: { dev: "node app.mjs" },
  }), "utf8");
  writeFileSync(join(root, "task.json"), JSON.stringify({
    id: "doctor-task",
    title: "Doctor task",
    description: "Check doctor setup",
    acceptanceCriteria: [{ id: "AC-001", description: "The app is visible" }],
    verification: { testFile: "tests/doctor_test.md" },
  }), "utf8");
  if (testFile) writeFileSync(join(root, "tests", "doctor_test.md"), "# Doctor test\n", "utf8");
  if (config) writeFileSync(join(root, ".elenchos", "config.json"), JSON.stringify({
    repository: ".",
    agent: { provider: "gemini", command: "gemini" },
    application: { start: "node app.mjs", url: "http://127.0.0.1:3000" },
    verification: { timeoutSeconds: 300, headless: true },
  }), "utf8");
}

function readyKane() {
  return {
    ready: true,
    installed: true,
    source: "test",
    action: null,
    identity: { status: "authenticated", authenticated: true, profile: "default", environment: "test", method: "test", expires: null },
    balance: { status: "available", available: 100, total: 100 },
  };
}

test("doctor separates basic MCP readiness from Kane verification readiness", async () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-doctor-basic-"));
  try {
    const report = await createDoctorReport(root, {
      checkKane: async () => ({
        ready: false,
        installed: true,
        source: "test",
        action: "Authenticate Kane with kane-cli login",
        identity: { status: "needs_authentication", authenticated: false, profile: "default", environment: "test", method: "test", expires: null },
        balance: { status: "available", available: 50, total: 100 },
      }),
    });
    assert.equal(report.mcp.status, "ready");
    assert.equal(report.status, "ready");
    assert.equal(report.basic.status, "ready");
    assert.equal(report.verification.status, "needs_setup");
    assert.equal(report.project.status, "missing");
    assert.equal(report.kane.identity.authenticated, false);
    assert.equal(report.kane.balance.available, 50);
    assert.match(report.nextSteps.join("\n"), /npx elenchos init/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("doctor reports a complete project and task contract", async () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-doctor-ready-"));
  try {
    writeProject(root);
    const report = await createDoctorReport(root, {
      taskPath: "task.json",
      checkKane: async () => readyKane(),
      checkMcp: async () => ({ status: "ready", transport: "stdio", toolCount: 5, tools: [] }),
    });
    assert.equal(report.status, "ready");
    assert.equal(report.basic.status, "ready");
    assert.equal(report.verification.status, "ready");
    assert.equal(report.task.status, "ready");
    assert.equal(report.task.testFile, join("tests", "doctor_test.md"));
    assert.equal(report.nextSteps.length, 0);
    assert.match(formatDoctorReport(report), /Verification setup: ready/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("doctor identifies a missing Kane test file", async () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-doctor-task-"));
  try {
    writeProject(root, { testFile: false });
    const report = await createDoctorReport(root, {
      taskPath: "task.json",
      checkKane: async () => readyKane(),
      checkMcp: async () => ({ status: "ready", transport: "stdio", toolCount: 5, tools: [] }),
    });
    assert.equal(report.task.status, "missing");
    assert.deepEqual(report.task.missing, [join("tests", "doctor_test.md")]);
    assert.equal(report.verification.status, "needs_setup");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the MCP doctor handshake exposes the registered server tools", async () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-doctor-mcp-"));
  try {
    const result = await checkMcpReadiness(root);
    assert.equal(result.status, "ready");
    assert.equal(result.transport, "stdio");
    assert.deepEqual(result.tools, [
      "elenchos_inspect",
      "elenchos_load_task",
      "elenchos_contract",
      "elenchos_status",
      "elenchos_verify",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
