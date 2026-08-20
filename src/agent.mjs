import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { commandExists, runCommand } from "./process.mjs";
import { replacePrompt, trimForLog } from "./utils.mjs";

function detectAgent() {
  return detectAgents()[0] ?? null;
}

export function detectAgents() {
  return ["agy", "claude", "gemini", "codex"].filter((candidate) => commandExists(candidate));
}

export function defaultAgentConfig(provider = detectAgent()) {
  if (!provider) return null;
  if (provider === "agy") {
    return {
      provider: "gemini",
      command: "agy",
      args: ["--agent", "gemini", "--add-dir", "{{cwd}}", "--print", "{{prompt}}", "--output-format", "json", "--mode", "accept-edits", "--print-timeout", "300s"],
      timeoutMs: 330000,
    };
  }
  if (provider === "claude") {
    return {
      provider,
      command: "claude",
      args: ["-p", "{{prompt}}", "--output-format", "json", "--permission-mode", "acceptEdits"],
      timeoutMs: 120000,
    };
  }
  if (provider === "gemini") {
    return {
      provider,
      command: "gemini",
      args: ["-p", "{{prompt}}"],
      timeoutMs: 120000,
    };
  }
  return {
    provider,
    command: "codex",
    args: ["exec", "--full-auto", "{{prompt}}"],
    timeoutMs: 120000,
  };
}

function renderAgentCommand(config, prompt, cwd) {
  const args = Array.isArray(config.args)
    ? config.args.map((arg) => replacePrompt(arg, prompt).split("{{cwd}}").join(cwd))
    : [prompt];
  return { command: config.command, args };
}

function structuredAgentFailure(stdout) {
  const candidates = String(stdout ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).reverse();
  for (const candidate of candidates) {
    if (!candidate.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(candidate);
      const status = String(parsed.status ?? "").toUpperCase();
      if (parsed.is_error === true || ["ERROR", "FAILED", "FAILURE"].includes(status)) {
        return parsed.error || parsed.message || `Agent reported ${status || "an error"}`;
      }
      if (["SUCCESS", "SUCCEEDED", "OK"].includes(status)) return null;
    } catch { /* Ignore non-JSON agent narration. */ }
  }
  return null;
}

export function isAuthenticationFailure(value) {
  return /(?:401|unauthori[sz]ed|invalid token|failed to authenticate|authentication (?:failed|required|timed out)|login required)/i.test(String(value ?? ""));
}

export function buildImplementationPrompt(task, cwd) {
  return [
    "You are the implementation agent inside an Elenchos verification run.",
    `Work only in the repository at ${cwd}.`,
    "Implement the task below. Keep acceptance criteria stable and do not edit the task or Kane test to hide a failure.",
    "Use the existing project conventions. Make the smallest production-quality change, and run relevant local checks.",
    "When finished, summarize files changed and checks run. The Elenchos orchestrator will decide verification status from Kane, not from your narration.",
    "",
    JSON.stringify(task, null, 2),
  ].join("\n");
}

export function buildRepairPrompt(task, failure, cwd, attempt) {
  return [
    "You are repairing a task inside an Elenchos verification run.",
    `Work only in the repository at ${cwd}. This is repair attempt ${attempt}.`,
    "Fix the implementation that caused the verification failure. Do not change acceptance criteria or weaken the Kane test.",
    "Preserve the existing verification contract and make the smallest reliable code change. Run relevant local checks before finishing.",
    "",
    "TASK:",
    JSON.stringify(task, null, 2),
    "",
    "KANE FAILURE EVIDENCE:",
    trimForLog(JSON.stringify(failure, null, 2), 18000),
  ].join("\n");
}

export async function runAgent({ config, prompt, cwd, signal }) {
  if (!config?.command) throw new Error("No coding-agent command configured");
  const { command, args } = renderAgentCommand(config, prompt, cwd);
  const env = { ...(config.env ?? {}) };
  const gitTools = join(process.env.ProgramFiles ?? "C:\\Program Files", "Git", "usr", "bin");
  if (process.platform === "win32" && command.toLowerCase() === "agy" && existsSync(join(gitTools, "grep.exe"))) {
    env.PATH = `${gitTools}${delimiter}${env.PATH ?? process.env.PATH ?? ""}`;
  }
  const result = await runCommand({
    command,
    args,
    cwd: config.launchCwd ?? cwd,
    env,
    timeoutMs: config.timeoutMs ?? 300000,
    signal,
  });
  if (result.error) throw new Error(`Agent process could not start: ${result.error.message}`);
  if (result.cancelled) throw new Error("Agent run cancelled");
  if (result.timedOut) throw new Error(`Agent timed out after ${config.timeoutMs ?? 120000}ms`);
  if (result.exitCode !== 0) {
    const raw = result.stderr || result.stdout;
    if (isAuthenticationFailure(raw)) {
      throw new Error(`Agent authentication failed for ${config.provider ?? config.command}. Refresh that agent's credentials before retrying.`);
    }
    throw new Error(`Agent exited with code ${result.exitCode}: ${trimForLog(raw, 4000)}`);
  }
  const reportedFailure = structuredAgentFailure(result.stdout);
  if (reportedFailure) throw new Error(`Agent reported an error: ${trimForLog(reportedFailure, 4000)}`);
  return {
    provider: config.provider ?? config.command,
    exitCode: result.exitCode,
    stdout: trimForLog(result.stdout),
    stderr: trimForLog(result.stderr),
  };
}

export { structuredAgentFailure };
