import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initProject } from "../src/config.mjs";

test("init keeps Elenchos and TestMu state in the repository local Git exclude", async () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-config-"));
  try {
    execFileSync("git", ["init"], { cwd: root, windowsHide: true });
    const result = await initProject(root, {
      checkKane: async () => ({ ready: true, installed: true, source: "test", action: null }),
    });
    const exclude = readFileSync(join(root, ".git", "info", "exclude"), "utf8");
    assert.match(exclude, /^\.elenchos\/$/m);
    assert.match(exclude, /^\.testmuai\/$/m);
    assert.equal(result.config.detected.localGitExcludes, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
