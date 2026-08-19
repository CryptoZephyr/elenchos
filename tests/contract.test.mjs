import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertVerificationContract, createVerificationContract } from "../src/contract.mjs";

test("locks the task and Kane test for the life of a run", () => {
  const directory = mkdtempSync(join(tmpdir(), "elenchos-contract-"));
  const taskPath = join(directory, "task.json");
  const testPath = join(directory, "proof_test.md");
  const task = {
    id: "task-1",
    title: "Proof",
    description: "Show proof",
    acceptanceCriteria: [{ id: "AC-001", description: "The page loads" }],
    verification: { testFile: "proof_test.md" },
    source: taskPath,
  };
  writeFileSync(taskPath, JSON.stringify(task), "utf8");
  writeFileSync(testPath, "---\nmode: testing\n---\n", "utf8");
  try {
    const contract = createVerificationContract(task, testPath);
    assert.doesNotThrow(() => assertVerificationContract(contract, task));
    writeFileSync(testPath, "changed", "utf8");
    assert.throws(() => assertVerificationContract(contract, task), /contract changed/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
