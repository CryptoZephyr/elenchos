import test from "node:test";
import assert from "node:assert/strict";
import { shellSplit } from "../src/utils.mjs";

test("splits configured application commands with quoted arguments", () => {
  assert.deepEqual(shellSplit('node demo/target-app.mjs --label "Proof Board"'), [
    "node",
    "demo/target-app.mjs",
    "--label",
    "Proof Board",
  ]);
});
