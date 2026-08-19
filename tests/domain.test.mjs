import test from "node:test";
import assert from "node:assert/strict";
import { createRun, normalizeTask, transitionRun } from "../src/domain.mjs";

test("normalizes acceptance criteria with stable ids", () => {
  const task = normalizeTask({
    id: "demo",
    title: "Demo",
    acceptanceCriteria: ["The page loads", { id: "AC-009", description: "A button works" }],
  });
  assert.deepEqual(task.acceptanceCriteria, [
    { id: "AC-001", description: "The page loads" },
    { id: "AC-009", description: "A button works" },
  ]);
});

test("rejects duplicate criterion ids", () => {
  assert.throws(() => normalizeTask({
    id: "demo",
    title: "Demo",
    acceptanceCriteria: [
      { id: "AC-001", description: "First" },
      { id: "AC-001", description: "Second" },
    ],
  }), /Duplicate acceptance criterion id/);
});

test("enforces the explicit run state machine", () => {
  const run = createRun(normalizeTask({
    id: "demo",
    title: "Demo",
    acceptanceCriteria: ["The page loads"],
  }), "test-agent");
  transitionRun(run, "IMPLEMENTING");
  transitionRun(run, "STARTING_APP");
  transitionRun(run, "VERIFYING");
  transitionRun(run, "FAILED");
  transitionRun(run, "REPAIRING");
  transitionRun(run, "STARTING_APP");
  assert.equal(run.status, "STARTING_APP");
  assert.throws(() => transitionRun(run, "VERIFIED"), /Invalid run transition/);
});
