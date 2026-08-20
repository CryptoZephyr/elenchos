import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isAuthenticationFailure, runAgent, structuredAgentFailure } from "../src/agent.mjs";

test("rejects a structured agent error even when the process exits cleanly", () => {
  const output = JSON.stringify({ status: "ERROR", message: "helper command missing" });
  assert.equal(structuredAgentFailure(output), "helper command missing");
});

test("accepts a structured successful agent result", () => {
  assert.equal(structuredAgentFailure(JSON.stringify({ status: "SUCCESS" })), null);
});

test("does not let unrelated trailing JSON hide an earlier agent error", () => {
  const output = [
    JSON.stringify({ status: "ERROR", message: "edit failed" }),
    JSON.stringify({ usage: { tokens: 20 } }),
  ].join("\n");
  assert.equal(structuredAgentFailure(output), "edit failed");
});

test("recognizes interactive authentication failures before logging agent output", () => {
  assert.equal(isAuthenticationFailure("Authentication required. Open the login URL."), true);
  assert.equal(isAuthenticationFailure("Authentication timed out"), true);
  assert.equal(isAuthenticationFailure("Implementation failed a unit test"), false);
});

test("can launch an agent from its authenticated directory while passing the workspace", async () => {
  const launchCwd = mkdtempSync(join(tmpdir(), "elenchos-agent-launch-"));
  const workspace = mkdtempSync(join(tmpdir(), "elenchos-agent-workspace-"));
  try {
    const result = await runAgent({
      config: {
        provider: "fixture",
        command: process.execPath,
        launchCwd,
        args: ["-e", "console.log(JSON.stringify({ launch: process.cwd(), workspace: process.argv[1] }))", "{{cwd}}"],
      },
      prompt: "unused",
      cwd: workspace,
    });
    const output = JSON.parse(result.stdout);
    assert.equal(output.launch.toLowerCase(), launchCwd.toLowerCase());
    assert.equal(output.workspace.toLowerCase(), workspace.toLowerCase());
  } finally {
    rmSync(launchCwd, { recursive: true, force: true });
    rmSync(workspace, { recursive: true, force: true });
  }
});
