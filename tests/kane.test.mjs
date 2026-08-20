import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseKaneResult } from "../src/kane.mjs";
import { normalizeVerificationStatus } from "../src/domain.mjs";

test("normalizes Kane status values", () => {
  assert.equal(normalizeVerificationStatus("passed"), "PASS");
  assert.equal(normalizeVerificationStatus("failed"), "FAIL");
  assert.equal(normalizeVerificationStatus("verifier_error"), "VERIFIER_ERROR");
  assert.equal(normalizeVerificationStatus("unknown"), "INCONCLUSIVE");
});

test("parses machine-readable Kane output without trusting agent narration", () => {
  const result = parseKaneResult({
    stdout: '{"type":"run_finished","status":"passed","session_id":"session-1"}\n',
    stderr: "agent said it was done",
    exitCode: 0,
    resultMarkdownPath: "C:/path/that/does/not/exist/Result.md",
    criteria: [{ id: "AC-001", description: "The page loads" }],
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.sessionId, "session-1");
  assert.equal(result.criteria[0].status, "UNVERIFIED");
});

test("classifies a non-zero Kane process without a result as verifier error", () => {
  const result = parseKaneResult({
    stdout: "",
    stderr: "no credentials",
    exitCode: 2,
    resultMarkdownPath: "C:/path/that/does/not/exist/Result.md",
    criteria: [{ id: "AC-001", description: "The page loads" }],
  });
  assert.equal(result.status, "VERIFIER_ERROR");
  assert.equal(result.criteria[0].status, "UNVERIFIED");
});

test("does not promote an inner test step pass to an overall test pass", () => {
  const result = parseKaneResult({
    stdout: [
      JSON.stringify({ type: "run_end", status: "passed" }),
      JSON.stringify({ type: "test_md_step_start", step_index: 1, heading: "Open app" }),
      JSON.stringify({ type: "test_md_step_end", step_index: 1, status: "passed" }),
      JSON.stringify({ type: "test_md_step_start", step_index: 2, heading: "AC-002 Add item" }),
      JSON.stringify({ type: "test_md_step_end", step_index: 2, status: "failed" }),
      JSON.stringify({ type: "test_md_done", status: "failed" }),
    ].join("\n"),
    stderr: "",
    exitCode: 1,
    resultMarkdownPath: "C:/path/that/does/not/exist/Result.md",
    criteria: [
      { id: "AC-001", description: "The page loads" },
      { id: "AC-002", description: "An item appears" },
      { id: "AC-003", description: "The count updates" },
    ],
  });
  assert.equal(result.status, "FAIL");
  assert.deepEqual(result.criteria.map((criterion) => criterion.status), ["UNVERIFIED", "FAIL", "UNVERIFIED"]);
});

test("classifies a timed-out partial test as verifier error", () => {
  const result = parseKaneResult({
    stdout: JSON.stringify({ type: "run_end", status: "passed" }),
    stderr: "",
    exitCode: null,
    timedOut: true,
    resultMarkdownPath: "C:/path/that/does/not/exist/Result.md",
    criteria: [{ id: "AC-001", description: "The page loads" }],
  });
  assert.equal(result.status, "VERIFIER_ERROR");
  assert.equal(result.criteria[0].status, "UNVERIFIED");
});

test("keeps Kane environment failures separate from product failures", () => {
  const result = parseKaneResult({
    stdout: [
      JSON.stringify({ type: "run_end", status: "failed", reason: "screenshot timeout", verdict: {
        confirmed: false,
        family: "environment_issue",
        category: "platform_failure",
      } }),
      JSON.stringify({ type: "test_md_step_end", step_index: 1, status: "failed" }),
    ].join("\n"),
    stderr: "",
    exitCode: 1,
    resultMarkdownPath: "C:/path/that/does/not/exist/Result.md",
    criteria: [{ id: "AC-001", description: "The page loads" }],
  });
  assert.equal(result.status, "VERIFIER_ERROR");
  assert.equal(result.criteria[0].status, "UNVERIFIED");
});

test("classifies an analyzer timeout without a bug verdict as verifier error", () => {
  const result = parseKaneResult({
    stdout: [
      JSON.stringify({ type: "run_end", status: "failed", reason: "analyzer_failed: @ step 5" }),
      JSON.stringify({ type: "test_md_step_end", step_index: 1, status: "failed" }),
    ].join("\n"),
    stderr: "",
    exitCode: 1,
    timedOut: true,
    resultMarkdownPath: "C:/path/that/does/not/exist/Result.md",
    criteria: [{ id: "AC-001", description: "The page loads" }],
  });
  assert.equal(result.status, "VERIFIER_ERROR");
  assert.equal(result.criteria[0].status, "UNVERIFIED");
});

test("rejects a stale Result.md when the current process has no structured events", () => {
  const directory = mkdtempSync(join(tmpdir(), "elenchos-kane-"));
  const resultPath = join(directory, "Result.md");
  writeFileSync(resultPath, "---\nstatus: passed\nsession_id: old-session\n---\n\n✓ old pass\n", "utf8");
  try {
    const result = parseKaneResult({
      stdout: "Kane finished",
      stderr: "",
      exitCode: 0,
      resultMarkdownPath: resultPath,
      criteria: [{ id: "AC-001", description: "The page loads" }],
    });
    assert.equal(result.status, "VERIFIER_ERROR");
    assert.equal(result.resultMarkdownPath, null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects an incomplete testmd flow even when its inner run passed", () => {
  const result = parseKaneResult({
    stdout: [
      JSON.stringify({ type: "test_md_step_start", step_index: 1 }),
      JSON.stringify({ type: "run_end", status: "passed" }),
      JSON.stringify({ type: "test_md_step_end", step_index: 1, status: "passed" }),
    ].join("\n"),
    stderr: "",
    exitCode: 0,
    resultMarkdownPath: "C:/missing/Result.md",
    criteria: [{ id: "AC-001", description: "The page loads" }],
  });
  assert.equal(result.status, "VERIFIER_ERROR");
});

test("does not let an inner run pass override a failed testmd terminal event", () => {
  const result = parseKaneResult({
    stdout: [
      JSON.stringify({ type: "test_md_step_start", step_index: 1, heading: "AC-001 Page loads" }),
      JSON.stringify({ type: "test_md_step_end", step_index: 1, status: "failed" }),
      JSON.stringify({ type: "test_md_done", status: "failed" }),
      JSON.stringify({ type: "run_end", status: "passed", session_id: "session-2" }),
    ].join("\n"),
    stderr: "",
    exitCode: 0,
    resultMarkdownPath: "C:/missing/Result.md",
    criteria: [{ id: "AC-001", description: "The page loads" }],
  });
  assert.equal(result.status, "FAIL");
  assert.equal(result.criteria[0].status, "FAIL");
});

test("treats an unconfirmed timed-out application verdict as verifier error", () => {
  const result = parseKaneResult({
    stdout: [
      JSON.stringify({ type: "test_md_step_start", step_index: 1, heading: "AC-001 Page loads" }),
      JSON.stringify({ type: "test_md_step_end", step_index: 1, status: "failed" }),
      JSON.stringify({ type: "test_md_done", status: "failed" }),
      JSON.stringify({ type: "run_end", status: "failed", verdict: { confirmed: false, family: "application_issue" } }),
    ].join("\n"),
    stderr: "",
    exitCode: 1,
    timedOut: true,
    resultMarkdownPath: "C:/missing/Result.md",
    criteria: [{ id: "AC-001", description: "The page loads" }],
  });
  assert.equal(result.status, "VERIFIER_ERROR");
  assert.equal(result.criteria[0].status, "UNVERIFIED");
});

test("does not promote unmapped criteria from an overall pass", () => {
  const result = parseKaneResult({
    stdout: [
      JSON.stringify({ type: "test_md_step_start", step_index: 1, heading: "Open the page" }),
      JSON.stringify({ type: "test_md_step_end", step_index: 1, status: "passed" }),
      JSON.stringify({ type: "test_md_done", status: "passed" }),
    ].join("\n"),
    stderr: "",
    exitCode: 0,
    resultMarkdownPath: "C:/missing/Result.md",
    criteria: [{ id: "AC-001", description: "The page loads" }],
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.criteria[0].status, "UNVERIFIED");
});

test("requires a complete testmd flow when parsing testmd execution", () => {
  const result = parseKaneResult({
    stdout: JSON.stringify({ type: "run_finished", status: "passed", session_id: "inner-run" }),
    stderr: "",
    exitCode: 0,
    requireTestMd: true,
    resultMarkdownPath: "C:/missing/Result.md",
    criteria: [{ id: "AC-001", description: "The page loads" }],
  });
  assert.equal(result.status, "VERIFIER_ERROR");
});

test("summarizes Kane progress, mapped observations, and the evidence pack hint", () => {
  const result = parseKaneResult({
    stdout: [
      JSON.stringify({ step: 1, status: "passed", remark: "Opened the app" }),
      JSON.stringify({ step: 2, status: "passed", remark: "Added the task" }),
      JSON.stringify({ type: "test_md_step_start", step_index: 2, heading: "AC-001 Add the task" }),
      JSON.stringify({ type: "test_md_step_end", step_index: 2, status: "passed", remark: "The task is visible", id: "step-2" }),
      JSON.stringify({ type: "run_end", status: "passed", final_url: "http://127.0.0.1:3000/", screenshot_path: "C:/private/step.png" }),
      JSON.stringify({ type: "test_md_done", status: "passed" }),
    ].join("\n"),
    stderr: "evidence: view locally with `kane-cli evidence serve C:/private/run.evidence`",
    exitCode: 0,
    resultMarkdownPath: "C:/missing/Result.md",
    criteria: [{ id: "AC-001", description: "The task appears" }],
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.stepsTaken, 2);
  assert.deepEqual(result.actions, ["Opened the app", "Added the task"]);
  assert.equal(result.evidence.available, true);
  assert.equal(result.finalUrl, "http://127.0.0.1:3000/");
  assert.equal(result.screenshotPath, "C:/private/step.png");
  assert.equal(result.criteria[0].status, "PASS");
  assert.equal(result.criteria[0].observed, "The task is visible");
  assert.equal(result.criteria[0].evidence.eventId, "step-2");
  assert.equal(result.criteria[0].evidence.screenshot, "C:/private/step.png");
});

test("classifies a cancelled Kane process as a verifier error", () => {
  const result = parseKaneResult({
    stdout: JSON.stringify({ type: "run_end", status: "passed" }),
    stderr: "",
    exitCode: null,
    cancelled: true,
    resultMarkdownPath: "C:/missing/Result.md",
    criteria: [{ id: "AC-001", description: "The page loads" }],
  });
  assert.equal(result.status, "VERIFIER_ERROR");
  assert.equal(result.cancelled, true);
});
