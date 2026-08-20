import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { redactText, redactValue, repositoryPath, shellSplit } from "../src/utils.mjs";

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

test("preserves Windows backslashes inside quoted application paths", () => {
  const command = String.raw`node "C:\Program Files\Demo\server.mjs"`;
  assert.deepEqual(shellSplit(command, { windows: true }), [
    "node",
    String.raw`C:\Program Files\Demo\server.mjs`,
  ]);
});

test("redacts prefixed and camel-case credential keys", () => {
  const value = redactValue({ KANE_ACCESS_KEY: "access-secret", github_token: "token-secret", clientSecret: "client-secret" });
  assert.deepEqual(value, {
    KANE_ACCESS_KEY: "[REDACTED]",
    github_token: "[REDACTED]",
    clientSecret: "[REDACTED]",
  });
  const text = redactText("KANE_ACCESS_KEY=access-secret github_token=token-secret");
  assert.equal(text, "KANE_ACCESS_KEY=[REDACTED] github_token=[REDACTED]");
});

test("rejects lexical and symlink escapes from a repository root", () => {
  const root = mkdtempSync(join(tmpdir(), "elenchos-path-root-"));
  const outside = mkdtempSync(join(tmpdir(), "elenchos-path-outside-"));
  const linked = join(root, "linked");
  try {
    writeFileSync(join(outside, "secret.txt"), "secret\n", "utf8");
    symlinkSync(outside, linked, process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => repositoryPath(root, "../outside/secret.txt"), /inside the configured repository/);
    assert.throws(() => repositoryPath(root, "linked/secret.txt"), /inside the configured repository/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
