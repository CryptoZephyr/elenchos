import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { sha256 } from "./utils.mjs";

function git(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`Git command failed: git ${args.join(" ")}\n${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function changedPaths(status) {
  return status.split(/\r?\n/).filter(Boolean).map((line) => {
    const raw = line.slice(3).trim();
    return raw.includes(" -> ") ? raw.split(" -> ").at(-1) : raw;
  });
}

export function captureRepositoryState(cwd) {
  const root = resolve(git(cwd, ["rev-parse", "--show-toplevel"]).stdout.trim());
  const head = git(root, ["rev-parse", "HEAD"]).stdout.trim();
  const status = git(root, ["status", "--porcelain=v1", "--untracked-files=all"]).stdout.trimEnd();
  const files = changedPaths(status);
  const diff = git(root, ["diff", "--binary", "HEAD"]).stdout;
  const material = [diff];
  for (const path of files) {
    const absolutePath = resolve(root, path);
    if (existsSync(absolutePath)) {
      try { material.push(path, readFileSync(absolutePath)); } catch { material.push(path, "[unreadable]"); }
    } else material.push(path, "[deleted]");
  }
  return {
    root,
    head,
    dirty: Boolean(status.trim()),
    changedFiles: files,
    diffHash: sha256(Buffer.concat(material.map((item) => Buffer.isBuffer(item) ? item : Buffer.from(String(item))))),
  };
}

export function prepareWorkspace({ cwd, runId, mode }) {
  const baseline = captureRepositoryState(cwd);
  if (mode !== "run") {
    return { kind: "current", cwd: baseline.root, baseline };
  }
  if (baseline.dirty) {
    throw new Error("Elenchos run requires a clean Git worktree so the isolated agent workspace matches a known revision");
  }

  const workspace = join(baseline.root, ".elenchos", "workspaces", runId, "repository");
  mkdirSync(resolve(workspace, ".."), { recursive: true });
  git(baseline.root, ["worktree", "add", "--detach", workspace, baseline.head]);
  return {
    kind: "git-worktree",
    cwd: workspace,
    baseline,
  };
}
