import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectProject, initProject } from "../src/config.mjs";

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

test("detects project type and leaves ambiguous app choices visible", () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-detect-"));
  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({
      scripts: { dev: "vite", start: "node server.mjs" },
      devDependencies: { vite: "latest" },
    }), "utf8");
    const detected = detectProject(root);
    assert.equal(detected.detected.projectType, "vite");
    assert.equal(detected.application.start, null);
    assert.deepEqual(detected.detected.startCandidates.map((item) => item.value), ["npm run dev", "npm start"]);
    assert.match(detected.detected.needsSetup.join("\n"), /application\.start/);
    const selected = detectProject(root, { start: "npm run dev", url: "http://127.0.0.1:5173", agent: "gemini" });
    assert.equal(selected.application.start, "npm run dev");
    assert.equal(selected.application.url, "http://127.0.0.1:5173");
    assert.equal(selected.agent.provider, "gemini");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
