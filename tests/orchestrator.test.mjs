import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeRun } from "../src/orchestrator.mjs";
import { loadTask } from "../src/task.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
}

function repository() {
  const root = mkdtempSync(join(tmpdir(), "elenchos-orchestrator-"));
  git(root, "init");
  git(root, "config", "user.name", "Elenchos Test");
  git(root, "config", "user.email", "test@elenchos.local");
  writeFileSync(join(root, ".gitignore"), ".elenchos/\n", "utf8");
  writeFileSync(join(root, "app.txt"), "broken\n", "utf8");
  const taskPath = join(root, "task.json");
  writeFileSync(taskPath, JSON.stringify({
    id: "repair-demo",
    title: "Repair the demo",
    acceptanceCriteria: [{ id: "AC-001", description: "The demo works" }],
    verification: { testFile: "proof_test.md" },
  }), "utf8");
  writeFileSync(join(root, "proof_test.md"), "---\nmode: testing\n---\n\n# AC-001 Demo works\n", "utf8");
  git(root, "add", ".");
  git(root, "commit", "-m", "baseline");
  return { root, task: loadTask(taskPath) };
}

function config(overrides = {}) {
  return {
    agent: { provider: "fake", command: "fake" },
    application: { start: "fake", url: "http://127.0.0.1:3000" },
    verification: { maxRepairAttempts: 1, verifyBeforeImplement: true, retainWorkspace: false, ...overrides },
  };
}

function application() {
  return { pid: 123, url: "http://127.0.0.1:3000", stop: async () => {} };
}

function verification(status) {
  return {
    status,
    criteria: [{ id: "AC-001", description: "The demo works", status }],
    events: [],
    rawEvidence: {},
  };
}

test("runs a product failure through repair and pass, then preserves evidence and cleans the worktree", async () => {
  const fixture = repository();
  let kaneCalls = 0;
  try {
    const result = await executeRun({
      task: fixture.task,
      config: config(),
      cwd: fixture.root,
      mode: "run",
      services: {
        startApplication: async () => application(),
        runKaneTest: async () => verification(kaneCalls++ === 0 ? "FAIL" : "PASS"),
        runAgent: async ({ cwd }) => {
          writeFileSync(join(cwd, "app.txt"), "fixed\n", "utf8");
          git(cwd, "add", "app.txt");
          git(cwd, "commit", "-m", "agent repair");
          return { provider: "fake", exitCode: 0, stdout: "fixed", stderr: "" };
        },
      },
    });
    assert.equal(result.run.status, "VERIFIED");
    assert.deepEqual(result.run.attempts.map((attempt) => attempt.verification.status), ["FAIL", "PASS"]);
    assert.equal(result.run.repository.cleanedUp, true);
    assert.equal(existsSync(result.run.repository.workspace), false);
    assert.match(readFileSync(result.run.workspaceEvidence.patchPath, "utf8"), /fixed/);
    assert.equal(readFileSync(join(result.run.workspaceEvidence.directory, "files", "app.txt"), "utf8"), "fixed\n");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("does not verify an overall pass with unmapped acceptance criteria", async () => {
  const fixture = repository();
  try {
    const result = await executeRun({
      task: fixture.task,
      config: config({ maxRepairAttempts: 0 }),
      cwd: fixture.root,
      mode: "verify",
      services: {
        startApplication: async () => application(),
        runKaneTest: async () => ({
          ...verification("PASS"),
          criteria: [{ id: "AC-001", description: "The demo works", status: "UNVERIFIED" }],
        }),
      },
    });
    assert.equal(result.run.status, "ERROR");
    assert.match(result.run.error, /did not verify every acceptance criterion/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rejects an empty repair commit that leaves implementation content unchanged", async () => {
  const fixture = repository();
  try {
    const result = await executeRun({
      task: fixture.task,
      config: config(),
      cwd: fixture.root,
      mode: "run",
      services: {
        startApplication: async () => application(),
        runKaneTest: async () => verification("FAIL"),
        runAgent: async ({ cwd }) => {
          git(cwd, "commit", "--allow-empty", "-m", "empty repair");
          return { provider: "fake", exitCode: 0, stdout: "done", stderr: "" };
        },
      },
    });
    assert.equal(result.run.status, "ERROR");
    assert.match(result.run.error, /did not change the implementation/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rejects a HEAD change that occurs during browser verification", async () => {
  const fixture = repository();
  try {
    const result = await executeRun({
      task: fixture.task,
      config: config({ maxRepairAttempts: 0 }),
      cwd: fixture.root,
      mode: "verify",
      services: {
        startApplication: async () => application(),
        runKaneTest: async ({ cwd }) => {
          git(cwd, "commit", "--allow-empty", "-m", "drift during verification");
          return verification("PASS");
        },
      },
    });
    assert.equal(result.run.status, "ERROR");
    assert.match(result.run.error, /Repository changed while Kane was verifying/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("records application startup failure as an error without invoking Kane", async () => {
  const fixture = repository();
  let kaneCalled = false;
  try {
    const result = await executeRun({
      task: fixture.task,
      config: config({ maxRepairAttempts: 0 }),
      cwd: fixture.root,
      mode: "verify",
      services: {
        startApplication: async () => { throw new Error("port unavailable"); },
        runKaneTest: async () => { kaneCalled = true; return verification("PASS"); },
      },
    });
    assert.equal(result.run.status, "ERROR");
    assert.match(result.run.error, /port unavailable/);
    assert.equal(kaneCalled, false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rejects a verification test path outside the repository", async () => {
  const fixture = repository();
  fixture.task.verification.testFile = "../outside_test.md";
  try {
    const result = await executeRun({
      task: fixture.task,
      config: config({ maxRepairAttempts: 0 }),
      cwd: fixture.root,
      mode: "verify",
    });
    assert.equal(result.run.status, "ERROR");
    assert.match(result.run.error, /inside the configured repository/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("propagates cancellation from application startup and records a cancelled run", async () => {
  const fixture = repository();
  const controller = new AbortController();
  let receivedSignal;
  let kaneCalled = false;
  try {
    const result = await executeRun({
      task: fixture.task,
      config: config({ maxRepairAttempts: 0 }),
      cwd: fixture.root,
      mode: "verify",
      signal: controller.signal,
      services: {
        startApplication: async ({ signal }) => {
          receivedSignal = signal;
          controller.abort();
          return application();
        },
        runKaneTest: async () => {
          kaneCalled = true;
          return verification("PASS");
        },
      },
    });
    assert.equal(receivedSignal, controller.signal);
    assert.equal(kaneCalled, false);
    assert.equal(result.run.status, "ERROR");
    assert.equal(result.run.cancelled, true);
    assert.match(result.run.error, /Run cancelled/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
