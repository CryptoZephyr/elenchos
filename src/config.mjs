import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { defaultAgentConfig, detectAgent } from "./agent.mjs";
import { checkKaneReadiness, locateKaneInvocation } from "./kane.mjs";
import { readJson } from "./utils.mjs";

export const CONFIG_PATH = join(".elenchos", "config.json");

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
      timeoutSeconds: 120,
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

export async function initProject(cwd, { force = false } = {}) {
  const path = join(cwd, CONFIG_PATH);
  if (existsSync(path) && !force) throw new Error(`Config already exists at ${path}. Use --force to replace it.`);
  const config = detectProject(cwd);
  const kane = await checkKaneReadiness(config.verification);
  config.detected.kaneInstalled = kane.installed;
  config.detected.kaneReady = kane.ready;
  config.detected.kaneAction = kane.action;
  mkdirSync(join(cwd, ".elenchos"), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return { path, config };
}
