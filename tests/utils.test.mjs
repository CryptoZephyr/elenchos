import test from "node:test";
import assert from "node:assert/strict";
import { redactText, shellSplit } from "../src/utils.mjs";

test("splits configured application commands with quoted arguments", () => {
  assert.deepEqual(shellSplit('node demo/target-app.mjs --label "Proof Board"'), [
    "node",
    "demo/target-app.mjs",
    "--label",
    "Proof Board",
  ]);
});

test("redacts transient OAuth query values", () => {
  const redacted = redactText("https://example.test/auth?state=temporary&code_challenge=challenge&client_id=public");
  assert.equal(redacted, "https://example.test/auth?state=[REDACTED]&code_challenge=[REDACTED]&client_id=public");
});
