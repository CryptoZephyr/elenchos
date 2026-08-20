import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureRepositoryState, prepareWorkspace, removeWorkspace, sameRepositoryState, writeWorkspaceEvidence } from "../src/workspace.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
}

test("creates an isolated worktree tied to a clean revision", () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-workspace-"));
  let workspace;
  try {
    git(root, "init");
    git(root, "config", "user.name", "Elenchos Test");
    git(root, "config", "user.email", "test@elenchos.local");
    writeFileSync(join(root, "app.txt"), "baseline\n", "utf8");
    git(root, "add", "app.txt");
    git(root, "commit", "-m", "baseline");

    workspace = prepareWorkspace({ cwd: root, runId: "run-test", mode: "run" });
    assert.equal(workspace.kind, "git-worktree");
    assert.equal(captureRepositoryState(workspace.cwd).dirty, false);
    writeFileSync(join(workspace.cwd, "app.txt"), "changed\n", "utf8");
    const changed = captureRepositoryState(workspace.cwd);
    assert.equal(changed.dirty, true);
    assert.deepEqual(changed.changedFiles, ["app.txt"]);
    const evidence = writeWorkspaceEvidence({ cwd: workspace.cwd, directory: join(root, "evidence") });
    assert.match(git(root, "status", "--short"), /evidence/);
    assert.match(readFileSync(evidence.patchPath, "utf8"), /changed/);
    removeWorkspace({ root, workspace: workspace.cwd });
    workspace = null;
  } finally {
    if (workspace) git(root, "worktree", "remove", "--force", workspace.cwd);
    rmSync(root, { recursive: true, force: true });
  }
});

test("repository identity includes HEAD as well as content changes", () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-identity-"));
  try {
    git(root, "init");
    git(root, "config", "user.name", "Elenchos Test");
    git(root, "config", "user.email", "test@elenchos.local");
    writeFileSync(join(root, "app.txt"), "baseline\n", "utf8");
    git(root, "add", "app.txt");
    git(root, "commit", "-m", "baseline");
    const before = captureRepositoryState(root);
    git(root, "commit", "--allow-empty", "-m", "revision drift");
    const after = captureRepositoryState(root);
    assert.equal(before.diffHash, after.diffHash);
    assert.equal(sameRepositoryState(before, after), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
