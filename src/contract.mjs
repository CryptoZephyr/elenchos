import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sha256 } from "./utils.mjs";

function fileHash(path) {
  return sha256(readFileSync(path));
}

function taskPayload(task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    acceptanceCriteria: task.acceptanceCriteria,
    verification: task.verification,
  };
}

export function createVerificationContract(task, testFile) {
  const absoluteTestFile = resolve(testFile);
  if (!existsSync(absoluteTestFile)) throw new Error(`Kane test not found: ${absoluteTestFile}`);
  if (!absoluteTestFile.toLowerCase().endsWith("_test.md")) {
    throw new Error(`Kane verification contract must end in _test.md: ${absoluteTestFile}`);
  }
  const taskSource = task.source && existsSync(task.source) ? resolve(task.source) : null;
  return Object.freeze({
    taskHash: sha256(JSON.stringify(taskPayload(task))),
    taskSource,
    taskSourceHash: taskSource ? fileHash(taskSource) : null,
    testFile: absoluteTestFile,
    testHash: fileHash(absoluteTestFile),
  });
}

export function assertVerificationContract(contract, task) {
  if (sha256(JSON.stringify(taskPayload(task))) !== contract.taskHash) {
    throw new Error("The normalized task changed during the run");
  }
  if (!existsSync(contract.testFile) || fileHash(contract.testFile) !== contract.testHash) {
    throw new Error("The Kane verification contract changed during the run");
  }
  if (contract.taskSource && (!existsSync(contract.taskSource) || fileHash(contract.taskSource) !== contract.taskSourceHash)) {
    throw new Error("The task source file changed during the run");
  }
}
