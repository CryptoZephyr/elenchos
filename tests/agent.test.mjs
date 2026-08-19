import test from "node:test";
import assert from "node:assert/strict";
import { structuredAgentFailure } from "../src/agent.mjs";

test("rejects a structured agent error even when the process exits cleanly", () => {
  const output = JSON.stringify({ status: "ERROR", message: "helper command missing" });
  assert.equal(structuredAgentFailure(output), "helper command missing");
});

test("accepts a structured successful agent result", () => {
  assert.equal(structuredAgentFailure(JSON.stringify({ status: "SUCCESS" })), null);
});
