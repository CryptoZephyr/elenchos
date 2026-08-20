export function formatRunSummary(run) {
  const lines = [
    `Run ${run.id}`,
    `Task: ${run.task.title} (${run.task.id})`,
    `Agent: ${run.agent}`,
    `Status: ${run.status}`,
    `Attempts: ${run.attempts.length}`,
  ];
  if (run.repository) lines.push(`Workspace: ${run.repository.kind} at ${run.repository.workspace}`);
  if (run.repository?.cleanedUp) lines.push("Workspace cleaned after evidence capture");
  if (run.verificationContractHash) lines.push(`Contract: ${run.verificationContractHash.slice(0, 12)}`);
  for (const attempt of run.attempts) {
    const verification = attempt.verification;
    const details = [
      verification.stepsTaken == null ? null : `${verification.stepsTaken} steps`,
      verification.duration == null ? null : `${verification.duration}s`,
    ].filter(Boolean).join(", ");
    lines.push(`  Attempt ${attempt.number}: ${verification.status}${details ? ` (${details})` : ""}`);
    if (verification.summary) lines.push(`    Summary: ${verification.summary}`);
    if (verification.actions?.length) lines.push(`    Actions: ${verification.actions.join("; ")}`);
    if (verification.testUrl) lines.push(`    Kane dashboard: ${verification.testUrl}`);
    else if (verification.finalUrl) lines.push(`    Final URL: ${verification.finalUrl}`);
    if (verification.credits != null) lines.push(`    Credits: ${verification.credits}`);
    if (verification.screenshotPath || verification.evidence?.screenshotPath) lines.push("    Screenshot evidence: captured");
    if (verification.error) lines.push(`    Kane error: ${verification.error}`);
    for (const failure of verification.failures ?? []) {
      if (failure.text) lines.push(`    Failure${failure.step == null ? "" : ` at step ${failure.step}`}: ${failure.text}`);
    }
    if (verification.evidence?.available) lines.push("    Evidence pack: captured");
    for (const criterion of verification.criteria ?? []) {
      lines.push(`    ${criterion.id}: ${criterion.status} - ${criterion.description}`);
      if (criterion.observed && criterion.observed !== criterion.description) {
        lines.push(`      Observed: ${String(criterion.observed).slice(0, 240)}`);
      }
    }
  }
  if (run.verifiedRevision) {
    lines.push(`Verified revision: ${run.verifiedRevision.head.slice(0, 12)} + ${run.verifiedRevision.diffHash.slice(0, 12)}`);
    if (run.verifiedRevision.changedFiles.length) lines.push(`Verified changes: ${run.verifiedRevision.changedFiles.join(", ")}`);
  }
  if (run.error) lines.push(`Error: ${run.error}`);
  if (run.cleanupError) lines.push(`Cleanup error: ${run.cleanupError}`);
  return lines.join("\n");
}

export function printRunSummary(run, { json = false } = {}) {
  process.stdout.write(json ? `${formatRunJson(run)}\n` : `${formatRunSummary(run)}\n`);
}

export function formatRunJson(run) {
  return JSON.stringify(redactValue(run), null, 2);
}
import { redactValue } from "./utils.mjs";
