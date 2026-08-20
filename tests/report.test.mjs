import test from "node:test";
import assert from "node:assert/strict";
import { formatRunJson, formatRunSummary } from "../src/report.mjs";

test("formats the useful Kane result details without exposing raw evidence paths", () => {
  const summary = formatRunSummary({
    id: "run-1",
    task: { id: "task-1", title: "Proof" },
    agent: "gemini",
    status: "FAILED",
    attempts: [{
      number: 1,
      verification: {
        status: "FAIL",
        stepsTaken: 3,
        duration: 12,
        summary: "The task was not visible",
        actions: ["Opened the app"],
        finalUrl: "http://127.0.0.1:3000/",
        screenshotPath: "C:/private/step.png",
        failures: [{ step: 3, text: "The task was not visible" }],
        evidence: { available: true, packPath: "C:/private/run.evidence" },
        criteria: [{ id: "AC-001", description: "The task appears", status: "FAIL", observed: "The task was not visible" }],
      },
    }],
  });
  assert.match(summary, /3 steps, 12s/);
  assert.match(summary, /Evidence pack: captured/);
  assert.match(summary, /Screenshot evidence: captured/);
  assert.match(summary, /Observed: The task was not visible/);
  assert.doesNotMatch(summary, /private\/run\.evidence/);
});

test("redacts credential-bearing strings from JSON run output", () => {
  const output = formatRunJson({
    id: "run-secret",
    attempts: [{
      application: {
        url: "http://127.0.0.1:3000/?access_token=EXAMPLE_SECRET_VALUE",
      },
    }],
  });
  assert.doesNotMatch(output, /EXAMPLE_SECRET_VALUE/);
  assert.match(output, /access_token=\[REDACTED\]/);
});
