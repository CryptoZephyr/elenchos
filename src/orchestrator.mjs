import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { startApplication } from "./application.mjs";
import { buildImplementationPrompt, buildRepairPrompt, runAgent } from "./agent.mjs";
import { assertVerificationContract, createVerificationContract } from "./contract.mjs";
import { transitionRun, createRun } from "./domain.mjs";
import { runKaneTest } from "./kane.mjs";
import { createRunPersistence } from "./persistence.mjs";
import { nowIso } from "./utils.mjs";
import { captureRepositoryState, prepareWorkspace } from "./workspace.mjs";

function saveTransition(run, persistence, next, detail) {
  transitionRun(run, next, detail);
  persistence.save(run);
}

function testPathFor(task, config, root) {
  const configured = task.verification?.testFile ?? config.verification?.testFile;
  if (!configured) {
    throw new Error("A Kane-authored verification.testFile is required. Elenchos will not generate its own verification contract.");
  }
  return resolve(root, configured);
}

export async function executeRun({ task, config, cwd, mode = "run" }) {
  const run = createRun(task, config.agent?.provider ?? config.agent?.command ?? "none");
  const persistence = createRunPersistence(cwd, run.id);
  run.configPath = config.__path ?? null;
  persistence.save(run);
  const testFile = testPathFor(task, config, cwd);
  const contract = createVerificationContract(task, testFile);
  run.verificationContract = testFile;
  run.verificationContractHash = contract.testHash;
  run.taskHash = contract.taskHash;
  persistence.save(run);

  let application = null;
  try {
    const workspace = prepareWorkspace({ cwd, runId: run.id, mode });
    const executionCwd = workspace.cwd;
    run.repository = {
      kind: workspace.kind,
      workspace: executionCwd,
      baseline: workspace.baseline,
    };
    persistence.save(run);

    if (mode === "run" && config.verification?.verifyBeforeImplement !== true) {
      saveTransition(run, persistence, "IMPLEMENTING", "Send task to coding agent");
      const implementation = await runAgent({
        config: config.agent,
        prompt: buildImplementationPrompt(task, executionCwd),
        cwd: executionCwd,
      });
      run.implementation = { at: nowIso(), ...implementation };
      assertVerificationContract(contract, task);
      run.implementationRef = captureRepositoryState(executionCwd);
      persistence.save(run);
    }

    const maxRepairAttempts = Number(config.verification?.maxRepairAttempts ?? 0);
    if (!Number.isInteger(maxRepairAttempts) || maxRepairAttempts < 0 || maxRepairAttempts > 10) {
      throw new Error("verification.maxRepairAttempts must be an integer from 0 to 10");
    }
    let repairAttempt = 0;
    while (true) {
      const attemptNumber = run.attempts.length + 1;
      const attemptDirectory = join(persistence.directory, "attempts", String(attemptNumber).padStart(2, "0"));
      mkdirSync(attemptDirectory, { recursive: true });
      assertVerificationContract(contract, task);
      const verificationRef = captureRepositoryState(executionCwd);
      saveTransition(run, persistence, "STARTING_APP", `Start application for verification attempt ${run.attempts.length + 1}`);
      application = await startApplication({
        config: config.application ?? {},
        cwd: executionCwd,
        logDirectory: attemptDirectory,
      });
      saveTransition(run, persistence, "VERIFYING", `Run Kane contract ${testFile}`);
      const verification = await runKaneTest({
        testFile,
        cwd: executionCwd,
        criteria: task.acceptanceCriteria,
        config: config.verification ?? {},
        evidenceDirectory: attemptDirectory,
      });
      assertVerificationContract(contract, task);
      const verifiedRef = captureRepositoryState(executionCwd);
      if (verifiedRef.diffHash !== verificationRef.diffHash) {
        throw new Error("Repository changed while Kane was verifying it. The result was rejected.");
      }
      const attempt = {
        number: attemptNumber,
        at: nowIso(),
        verification,
        application: { pid: application.pid, url: application.url },
        implementationRef: verificationRef,
      };
      run.attempts.push(attempt);
      persistence.save(run);
      await application.stop();
      application = null;

      if (verification.status === "PASS") {
        run.verifiedRevision = verifiedRef;
        saveTransition(run, persistence, "VERIFIED", "Kane passed the verification contract");
        break;
      }
      if (verification.status !== "FAIL") {
        run.error = `Kane could not produce a product verification result: ${verification.status}`;
        saveTransition(run, persistence, "ERROR", run.error);
        break;
      }
      if (mode !== "run" || repairAttempt >= maxRepairAttempts) {
        saveTransition(run, persistence, "FAILED", "Acceptance criteria remain failed after bounded attempts");
        break;
      }

      repairAttempt += 1;
      saveTransition(run, persistence, "REPAIRING", `Return Kane failure evidence to the coding agent, attempt ${repairAttempt}`);
      const beforeRepair = captureRepositoryState(executionCwd);
      const repair = await runAgent({
        config: config.agent,
        prompt: buildRepairPrompt(task, verification, executionCwd, repairAttempt),
        cwd: executionCwd,
      });
      assertVerificationContract(contract, task);
      const afterRepair = captureRepositoryState(executionCwd);
      if (afterRepair.diffHash === beforeRepair.diffHash) {
        throw new Error("The coding agent reported a repair but did not change the implementation");
      }
      run.repairs ??= [];
      run.repairs.push({ attempt: repairAttempt, at: nowIso(), ...repair, implementationRef: afterRepair });
      persistence.save(run);
    }
  } catch (error) {
    if (application) await application.stop().catch(() => {});
    run.error = error instanceof Error ? error.message : String(error);
    if (!["VERIFIED", "FAILED", "ERROR"].includes(run.status)) saveTransition(run, persistence, "ERROR", run.error);
    else persistence.save(run);
  }

  run.completedAt ??= nowIso();
  persistence.save(run);
  return { run, persistence };
}
