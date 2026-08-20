import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { relative, resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { repositoryPath, sha256, writeJson } from "./utils.mjs";

function git(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`Git command failed: git ${args.join(" ")}\n${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function changedPaths(status) {
  const entries = status.split("\0").filter(Boolean);
  const paths = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const code = entry.slice(0, 2);
    paths.push(entry.slice(3));
    if (code.includes("R") || code.includes("C")) index += 1;
  }
  return paths;
}

function fileMaterial(path) {
  const stat = lstatSync(path);
  return stat.isSymbolicLink() ? Buffer.from(`symlink:${readlinkSync(path)}`) : readFileSync(path);
}

export function captureRepositoryState(cwd) {
  const root = resolve(git(cwd, ["rev-parse", "--show-toplevel"]).stdout.trim());
  const head = git(root, ["rev-parse", "HEAD"]).stdout.trim();
  const treeHash = git(root, ["rev-parse", "HEAD^{tree}"]).stdout.trim();
  const status = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]).stdout;
  const files = changedPaths(status);
  const diff = git(root, ["diff", "--binary", "HEAD"]).stdout;
  const material = [diff];
  for (const path of files) {
    const absolutePath = repositoryPath(root, path);
    if (existsSync(absolutePath)) {
      try { material.push(path, fileMaterial(absolutePath)); } catch { material.push(path, "[unreadable]"); }
    } else material.push(path, "[deleted]");
  }
  return {
    root,
    head,
    treeHash,
    dirty: Boolean(status),
    changedFiles: files,
    diffHash: sha256(Buffer.concat(material.map((item) => Buffer.isBuffer(item) ? item : Buffer.from(String(item))))),
  };
}

export function sameRepositoryState(before, after) {
  return before.head === after.head && before.diffHash === after.diffHash;
}

export function sameRepositoryContent(before, after) {
  return before.treeHash === after.treeHash && before.diffHash === after.diffHash;
}

export function writeWorkspaceEvidence({ cwd, directory, baselineHead = null }) {
  const state = captureRepositoryState(cwd);
  const diffBase = baselineHead ?? state.head;
  const evidenceDirectory = join(directory, "workspace-evidence");
  const filesDirectory = join(evidenceDirectory, "files");
  mkdirSync(filesDirectory, { recursive: true });
  const patchPath = join(evidenceDirectory, "changes.patch");
  writeFileSync(patchPath, git(state.root, ["diff", "--binary", diffBase]).stdout, "utf8");

  const baselineFiles = git(state.root, ["diff", "--name-only", "-z", diffBase]).stdout.split("\0").filter(Boolean);
  const changedFiles = [...new Set([...baselineFiles, ...state.changedFiles])];
  const files = [];
  for (const path of changedFiles) {
    const source = repositoryPath(state.root, path);
    if (!existsSync(source)) {
      files.push({ path, kind: "deleted" });
      continue;
    }
    const stat = lstatSync(source);
    if (stat.isSymbolicLink()) {
      files.push({ path, kind: "symlink", target: readlinkSync(source) });
      continue;
    }
    const destination = repositoryPath(filesDirectory, path);
    mkdirSync(resolve(destination, ".."), { recursive: true });
    copyFileSync(source, destination);
    files.push({ path, kind: "file" });
  }
  const manifestPath = join(evidenceDirectory, "manifest.json");
  writeJson(manifestPath, { baselineHead: diffBase, state, files });
  return { directory: evidenceDirectory, patchPath, manifestPath };
}

export function removeWorkspace({ root, workspace }) {
  const allowedRoot = join(resolve(root), ".elenchos", "workspaces");
  const requestedWorkspace = resolve(workspace);
  if (!relative(allowedRoot, requestedWorkspace)) {
    throw new Error(`Refusing to remove workspace root ${allowedRoot}`);
  }
  const absoluteWorkspace = repositoryPath(allowedRoot, requestedWorkspace);
  const removal = git(root, ["worktree", "remove", "--force", absoluteWorkspace], { allowFailure: true });
  if (removal.status === 0 || !existsSync(absoluteWorkspace)) return;

  const registered = git(root, ["worktree", "list", "--porcelain"]).stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => resolve(line.slice("worktree ".length)))
    .some((path) => path.toLowerCase() === absoluteWorkspace.toLowerCase());
  if (registered) {
    throw new Error(`Git command failed: git worktree remove --force ${absoluteWorkspace}\n${(removal.stderr || removal.stdout).trim()}`);
  }

  rmSync(absoluteWorkspace, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 });
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
