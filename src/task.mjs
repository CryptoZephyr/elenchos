import { resolve } from "node:path";
import { readJson } from "./utils.mjs";
import { normalizeTask } from "./domain.mjs";

export function loadTask(path) {
  const absolutePath = resolve(path);
  return normalizeTask(readJson(absolutePath), absolutePath);
}
