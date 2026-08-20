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
    lines.push(`  Attempt ${attempt.number}: ${attempt.verification.status}`);
    for (const criterion of attempt.verification.criteria ?? []) {
      lines.push(`    ${criterion.id}: ${criterion.status} - ${criterion.description}`);
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
  process.stdout.write(json ? `${JSON.stringify(run, null, 2)}\n` : `${formatRunSummary(run)}\n`);
}
