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

test("locks optional task setup and preconditions as part of the contract", () => {
  const directory = mkdtempSync(join(tmpdir(), "elenchos-contract-metadata-"));
  const taskPath = join(directory, "task.json");
  const testPath = join(directory, "proof_test.md");
  const task = {
    id: "task-1",
    title: "Proof",
    description: "Show proof",
    setup: ["Seed a record"],
    preconditions: { account: "ready" },
    acceptanceCriteria: [{ id: "AC-001", description: "The page loads" }],
    verification: { testFile: "proof_test.md" },
    source: taskPath,
  };
  writeFileSync(taskPath, JSON.stringify(task), "utf8");
  writeFileSync(testPath, "---\nmode: testing\n---\n", "utf8");
  try {
    const contract = createVerificationContract(task, testPath);
    const changed = { ...task, preconditions: { account: "missing" } };
    assert.throws(() => assertVerificationContract(contract, changed), /normalized task changed/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
