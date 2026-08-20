import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function writeFixture(root) {
  mkdirSync(join(root, ".elenchos"), { recursive: true });
  mkdirSync(join(root, "tests"), { recursive: true });
  const task = {
    id: "mcp-task",
    title: "MCP task",
    description: "Load a task through MCP",
    acceptanceCriteria: [{ id: "AC-001", description: "The task can be loaded" }],
    verification: { testFile: "tests/mcp_test.md" },
  };
  writeFileSync(join(root, "task.json"), JSON.stringify(task, null, 2) + "\n", "utf8");
  writeFileSync(join(root, "tests", "mcp_test.md"), [
    "---",
    "mode: testing",
    "target: chrome",
    "---",
    "",
    "# Session: mcp-task",
    "",
    "## AC-001 Load the task",
    "Open the page and confirm the task is visible.",
    "",
  ].join("\n"), "utf8");
  writeFileSync(join(root, ".elenchos", "config.json"), JSON.stringify({
    repository: ".",
    application: { start: "node app.mjs", url: "http://127.0.0.1:3000" },
    verification: {},
    mcp: { allowVerify: false },
  }, null, 2) + "\n", "utf8");
}

test("exposes safe Elenchos tools over stdio MCP", async () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-mcp-"));
  writeFixture(root);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("src", "cli.mjs"), "mcp", "--repo", root],
    cwd: process.cwd(),
    stderr: "pipe",
  });
  const client = new Client({ name: "elenchos-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.deepEqual(
      listed.tools.map((tool) => tool.name),
      ["elenchos_inspect", "elenchos_load_task", "elenchos_contract", "elenchos_status", "elenchos_verify"],
    );
    const verifyTool = listed.tools.find((tool) => tool.name === "elenchos_verify");
    assert.equal(verifyTool.annotations.destructiveHint, true);

    const loaded = await client.callTool({
      name: "elenchos_load_task",
      arguments: { taskPath: "task.json" },
    });
    assert.equal(loaded.isError, undefined);
    const loadedPayload = JSON.parse(loaded.content[0].text);
    assert.equal(loadedPayload.task.id, "mcp-task");
    assert.equal(loadedPayload.taskPath, "task.json");
    assert.equal(loadedPayload.task.source, undefined);

    const contract = await client.callTool({
      name: "elenchos_contract",
      arguments: { taskPath: "task.json" },
    });
    assert.equal(contract.isError, undefined);
    const contractPayload = JSON.parse(contract.content[0].text);
    assert.equal(contractPayload.testFile, join("tests", "mcp_test.md"));
    assert.match(contractPayload.taskHash, /^[a-f0-9]{64}$/);
    assert.match(contractPayload.testHash, /^[a-f0-9]{64}$/);

    const rejected = await client.callTool({
      name: "elenchos_load_task",
      arguments: { taskPath: "../task.json" },
    });
    assert.equal(rejected.isError, true);
    assert.match(rejected.content[0].text, /inside the configured repository/);

    const configRejected = await client.callTool({
      name: "elenchos_contract",
      arguments: { taskPath: "task.json", configPath: "../outside-config.json" },
    });
    assert.equal(configRejected.isError, true);
    assert.match(configRejected.content[0].text, /inside the configured repository/);

    const verificationDisabled = await client.callTool({
      name: "elenchos_verify",
      arguments: { taskPath: "task.json", confirm: true },
    });
    assert.equal(verificationDisabled.isError, true);
    assert.match(verificationDisabled.content[0].text, /MCP verification is disabled/);
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
});
