import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { sha256, writeJson } from "./utils.mjs";

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

function repositoryPath(root, path) {
  const absolutePath = resolve(root, path);
  const fromRoot = relative(root, absolutePath);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error(`Unsafe repository path: ${path}`);
  }
  return absolutePath;
}

function fileMaterial(path) {
  const stat = lstatSync(path);
  return stat.isSymbolicLink() ? Buffer.from(`symlink:${readlinkSync(path)}`) : readFileSync(path);
}

export function captureRepositoryState(cwd) {
  const root = resolve(git(cwd, ["rev-parse", "--show-toplevel"]).stdout.trim());
  const head = git(root, ["rev-parse", "HEAD"]).stdout.trim();
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
    dirty: Boolean(status),
    changedFiles: files,
    diffHash: sha256(Buffer.concat(material.map((item) => Buffer.isBuffer(item) ? item : Buffer.from(String(item))))),
  };
}

export function sameRepositoryState(before, after) {
  return before.head === after.head && before.diffHash === after.diffHash;
}

export function writeWorkspaceEvidence({ cwd, directory }) {
  const state = captureRepositoryState(cwd);
  const evidenceDirectory = join(directory, "workspace-evidence");
  const filesDirectory = join(evidenceDirectory, "files");
  mkdirSync(filesDirectory, { recursive: true });
  const patchPath = join(evidenceDirectory, "changes.patch");
  writeFileSync(patchPath, git(state.root, ["diff", "--binary", "HEAD"]).stdout, "utf8");

  const files = [];
  for (const path of state.changedFiles) {
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
  writeJson(manifestPath, { state, files });
  return { directory: evidenceDirectory, patchPath, manifestPath };
}

export function removeWorkspace({ root, workspace }) {
  const allowedRoot = join(resolve(root), ".elenchos", "workspaces");
  const absoluteWorkspace = resolve(workspace);
  const fromAllowedRoot = relative(allowedRoot, absoluteWorkspace);
  if (!fromAllowedRoot || fromAllowedRoot.startsWith("..") || isAbsolute(fromAllowedRoot)) {
    throw new Error(`Refusing to remove workspace outside ${allowedRoot}`);
  }
  git(root, ["worktree", "remove", "--force", absoluteWorkspace]);
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
