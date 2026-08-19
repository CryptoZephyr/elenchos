import { join } from "node:path";
import { ensureDirectory, writeJson } from "./utils.mjs";

export function createRunPersistence(cwd, runId) {
  const directory = join(cwd, ".elenchos", "runs", runId);
  ensureDirectory(directory);
  const path = join(directory, "run.json");
  return {
    directory,
    path,
    save(run) { writeJson(path, run); },
  };
}
