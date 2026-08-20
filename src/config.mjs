import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { defaultAgentConfig, detectAgents } from "./agent.mjs";
import { checkKaneReadiness, locateKaneInvocation } from "./kane.mjs";
import { readJson } from "./utils.mjs";

export const CONFIG_PATH = join(".elenchos", "config.json");

function ensureLocalGitExcludes(cwd) {
  const result = spawnSync("git", ["rev-parse", "--git-path", "info/exclude"], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return false;
  const output = result.stdout.trim();
  const path = resolve(cwd, output);
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  const additions = [".elenchos/", ".testmuai/"].filter((entry) => {
    return !current.split(/\r?\n/).some((line) => line.trim() === entry);
  });
  if (additions.length) appendFileSync(path, `${current.endsWith("\n") || !current ? "" : "\n"}${additions.join("\n")}\n`, "utf8");
  return true;
}

function readPackage(cwd) {
  const packagePath = join(cwd, "package.json");
  if (!existsSync(packagePath)) return null;
  try { return readJson(packagePath); } catch { return null; }
}

function detectProjectType(cwd, packageJson) {
  if (existsSync(join(cwd, "demo", "target-app.mjs"))) return "elenchos-demo";
  const dependencies = new Set([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
  ]);
  if (dependencies.has("next")) return "next";
  if (dependencies.has("vite")) return "vite";
  if (dependencies.has("astro")) return "astro";
  if (dependencies.has("@sveltejs/kit") || dependencies.has("svelte")) return "svelte";
  if (dependencies.has("express") || dependencies.has("fastify") || dependencies.has("koa")) return "node-server";
  if (packageJson) return "node";
  if (existsSync(join(cwd, "index.html"))) return "static";
  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "requirements.txt"))) return "python";
  return "unknown";
}

function detectStartCandidates(cwd, packageJson, projectType) {
  if (projectType === "elenchos-demo") return [{ value: "node demo/target-app.mjs", source: "demo/target-app.mjs" }];
  const scripts = packageJson?.scripts ?? {};
  const names = ["dev", "start", "preview", "serve", "demo"];
  return names.filter((name) => scripts[name]).map((name) => ({
    value: name === "start" ? "npm start" : `npm run ${name}`,
    source: `package.json#scripts.${name}`,
  }));
}

function detectUrlCandidates(projectType) {
  const ports = {
    vite: 5173,
    svelte: 5173,
    next: 3000,
    "node-server": 3000,
    astro: 4321,
    "elenchos-demo": 3000,
  };
  return ports[projectType] ? [{ value: `http://127.0.0.1:${ports[projectType]}`, source: `${projectType} default` }] : [];
}

function chooseCandidate(candidates, override) {
  if (override) return { value: override, source: "user override" };
  return candidates.length === 1 ? candidates[0] : null;
}

function authenticatedLaunchDirectory(agentConfig) {
  if (process.platform !== "win32" || agentConfig?.command !== "agy") return agentConfig;
  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  const launchCwd = join(systemRoot, "System32");
  return existsSync(launchCwd) ? { ...agentConfig, launchCwd } : agentConfig;
}

export function detectProject(cwd, overrides = {}) {
  const packageJson = readPackage(cwd);
  const projectType = detectProjectType(cwd, packageJson);
  const startCandidates = detectStartCandidates(cwd, packageJson, projectType);
  const urlCandidates = detectUrlCandidates(projectType);
  const agentCandidates = detectAgents();
  const selectedStart = chooseCandidate(startCandidates, overrides.start);
  const selectedUrl = chooseCandidate(urlCandidates, overrides.url);
  const selectedAgent = overrides.agent ?? (agentCandidates.length === 1 ? agentCandidates[0] : null);
  const needsSetup = [];
  if (!selectedStart) needsSetup.push(startCandidates.length > 1 ? "application.start (choose one detected command)" : "application.start");
  if (!selectedUrl) needsSetup.push(urlCandidates.length > 1 ? "application.url (choose one detected URL)" : "application.url");
  if (!selectedAgent) needsSetup.push(agentCandidates.length > 1 ? "agent (choose one detected CLI)" : "agent");
  const agentConfig = authenticatedLaunchDirectory(selectedAgent ? defaultAgentConfig(selectedAgent) : null);
  const kane = locateKaneInvocation();
  const isDemoFixture = projectType === "elenchos-demo";
  return {
    repository: ".",
    agent: agentConfig,
    application: {
      start: selectedStart?.value ?? null,
      url: selectedUrl?.value ?? null,
      readinessTimeoutMs: 60000,
      env: isDemoFixture ? { ELENCHOS_DEMO_BROKEN: "1" } : {},
    },
    verification: {
      command: kane.source === "PATH" || kane.source === "npx-fallback" ? undefined : kane.source,
      maxRepairAttempts: 2,
      verifyBeforeImplement: isDemoFixture,
      timeoutSeconds: 300,
      headless: true,
    },
    detected: {
      projectType,
      agent: selectedAgent ?? "needs-selection",
      agentCandidates,
      startCandidates,
      urlCandidates,
      needsSetup,
      kane: kane.source,
    },
  };
}

export function loadConfig(cwd, explicitPath) {
  const path = explicitPath ? resolve(cwd, explicitPath) : join(cwd, CONFIG_PATH);
  if (!existsSync(path)) throw new Error(`Missing Elenchos config at ${path}. Run: npx elenchos init`);
  const config = readJson(path);
  return { ...config, __path: path };
}

export async function initProject(cwd, { force = false, start, url, agent, checkKane = checkKaneReadiness } = {}) {
  const path = join(cwd, CONFIG_PATH);
  if (existsSync(path) && !force) throw new Error(`Config already exists at ${path}. Use --force to replace it.`);
  const config = detectProject(cwd, { start, url, agent });
  const kane = await checkKane(config.verification);
  config.detected.kaneInstalled = kane.installed;
  config.detected.kaneReady = kane.ready;
  config.detected.kaneAction = kane.action;
  config.detected.localGitExcludes = ensureLocalGitExcludes(cwd);
  mkdirSync(join(cwd, ".elenchos"), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return { path, config };
}
