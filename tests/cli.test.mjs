import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const cli = resolve("src", "cli.mjs");

function elenchos(cwd, ...args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", windowsHide: true });
}

test("boolean flags placed before a positional argument do not consume it", () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-cli-"));
  try {
    const result = elenchos(root, "status", "--json", "run-missing");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Run not found/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("status reads runs from the configured repository", () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-cli-repo-"));
  try {
    mkdirSync(join(root, ".elenchos"), { recursive: true });
    mkdirSync(join(root, "app", ".elenchos", "runs", "run-1"), { recursive: true });
    writeFileSync(join(root, ".elenchos", "config.json"), JSON.stringify({ repository: "app" }), "utf8");
    writeFileSync(join(root, "app", ".elenchos", "runs", "run-1", "run.json"), JSON.stringify({ id: "run-1", status: "VERIFIED" }), "utf8");
    const result = elenchos(root, "status", "run-1", "--json");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "VERIFIED");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
