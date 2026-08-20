import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { defaultAgentConfig, detectAgent } from "./agent.mjs";
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

function detectStartCommand(cwd) {
  if (existsSync(join(cwd, "demo", "target-app.mjs"))) return "node demo/target-app.mjs";
  const packagePath = join(cwd, "package.json");
  if (existsSync(packagePath)) {
    const packageJson = readJson(packagePath);
    if (packageJson.scripts?.dev) return "npm run dev";
    if (packageJson.scripts?.start) return "npm start";
    if (packageJson.scripts?.demo) return "npm run demo";
  }
  return null;
}

export function detectProject(cwd) {
  const agent = detectAgent();
  const kane = locateKaneInvocation();
  const isDemoFixture = existsSync(join(cwd, "demo", "target-app.mjs"));
  return {
    repository: ".",
    agent: defaultAgentConfig(agent),
    application: {
      start: detectStartCommand(cwd),
      url: "http://127.0.0.1:3000",
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
      agent: agent ?? "missing",
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

export async function initProject(cwd, { force = false, checkKane = checkKaneReadiness } = {}) {
  const path = join(cwd, CONFIG_PATH);
  if (existsSync(path) && !force) throw new Error(`Config already exists at ${path}. Use --force to replace it.`);
  const config = detectProject(cwd);
  const kane = await checkKane(config.verification);
  config.detected.kaneInstalled = kane.installed;
  config.detected.kaneReady = kane.ready;
  config.detected.kaneAction = kane.action;
  config.detected.localGitExcludes = ensureLocalGitExcludes(cwd);
  mkdirSync(join(cwd, ".elenchos"), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return { path, config };
}
