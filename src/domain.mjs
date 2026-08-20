import { createId, nowIso } from "./utils.mjs";

export const RUN_STATES = Object.freeze([
  "CREATED",
  "IMPLEMENTING",
  "STARTING_APP",
  "VERIFYING",
  "VERIFIED",
  "FAILED",
  "REPAIRING",
  "ERROR",
]);

const transitions = new Map([
  ["CREATED", new Set(["IMPLEMENTING", "STARTING_APP", "ERROR"])],
  ["IMPLEMENTING", new Set(["STARTING_APP", "ERROR"])],
  ["STARTING_APP", new Set(["VERIFYING", "ERROR"])],
  ["VERIFYING", new Set(["VERIFIED", "FAILED", "REPAIRING", "ERROR"])],
  ["FAILED", new Set(["REPAIRING", "ERROR"])],
  ["REPAIRING", new Set(["STARTING_APP", "ERROR"])],
  ["VERIFIED", new Set()],
  ["ERROR", new Set()],
]);

export function normalizeTask(raw, source = "unknown") {
  if (!raw || typeof raw !== "object") throw new Error(`Task must be an object: ${source}`);
  const id = String(raw.id ?? "").trim();
  const title = String(raw.title ?? "").trim();
  const description = String(raw.description ?? "").trim();
  if (!id || !title) throw new Error("Task requires non-empty id and title");

  const sourceCriteria = raw.acceptanceCriteria ?? raw.criteria;
  if (!Array.isArray(sourceCriteria) || sourceCriteria.length === 0) {
    throw new Error("Task requires at least one acceptanceCriteria item");
  }

  const acceptanceCriteria = sourceCriteria.map((item, index) => {
    if (typeof item === "string") {
      return { id: `AC-${String(index + 1).padStart(3, "0")}`, description: item.trim() };
    }
    const criterionId = String(item?.id ?? `AC-${String(index + 1).padStart(3, "0")}`).trim();
    const criterionDescription = String(item?.description ?? "").trim();
    if (!criterionId || !criterionDescription) {
      throw new Error(`Acceptance criterion ${index + 1} requires id and description`);
    }
    return { id: criterionId, description: criterionDescription };
  });

  const ids = new Set();
  for (const criterion of acceptanceCriteria) {
    if (ids.has(criterion.id)) throw new Error(`Duplicate acceptance criterion id: ${criterion.id}`);
    ids.add(criterion.id);
  }

  return {
    id,
    title,
    description,
    setup: raw.setup ?? null,
    preconditions: raw.preconditions ?? null,
    acceptanceCriteria,
    verification: raw.verification && typeof raw.verification === "object" ? raw.verification : {},
    source,
  };
}

export function createRun(task, agentProvider = "unknown") {
  const timestamp = nowIso();
  return {
    id: createId(),
    taskId: task.id,
    task,
    agent: agentProvider,
    status: "CREATED",
    startedAt: timestamp,
    completedAt: null,
    attempts: [],
    events: [{ at: timestamp, from: null, to: "CREATED", detail: "Run created" }],
  };
}

export function transitionRun(run, nextState, detail = "") {
  if (!RUN_STATES.includes(nextState)) throw new Error(`Unknown run state: ${nextState}`);
  const allowed = transitions.get(run.status);
  if (!allowed?.has(nextState)) {
    throw new Error(`Invalid run transition ${run.status} -> ${nextState}`);
  }
  const at = nowIso();
  run.events.push({ at, from: run.status, to: nextState, detail });
  run.status = nextState;
  if (["VERIFIED", "FAILED", "ERROR"].includes(nextState)) run.completedAt = at;
  return run;
}

export function normalizeVerificationStatus(value) {
  const status = String(value ?? "").trim().toLowerCase();
  if (["pass", "passed", "success", "succeeded", "verified", "ok"].includes(status)) return "PASS";
  if (["fail", "failed", "failure", "rejected"].includes(status)) return "FAIL";
  if (["error", "errored", "verifier_error", "verifier-error"].includes(status)) return "VERIFIER_ERROR";
  return "INCONCLUSIVE";
}
