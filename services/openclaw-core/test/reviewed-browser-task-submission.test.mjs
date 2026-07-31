import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReviewedBrowserTaskSubmission,
  REVIEWED_BROWSER_TASK_SUBMISSION_REGISTRY,
} from "../src/reviewed-browser-task-submission.mjs";

test("reviewed browser submission fixes task authority without starting execution", () => {
  const submission = buildReviewedBrowserTaskSubmission({
    goal: "  Inspect the customer record  ",
    targetUrl: "https://example.com/work",
    includePlan: true,
  });

  assert.deepEqual(submission.taskInput, {
    goal: "Inspect the customer record",
    type: "browser_task",
    targetUrl: "https://example.com/work",
    workViewStrategy: "ai-work-view",
    intent: "task.execute",
    includePlan: true,
    actions: [],
  });
  assert.equal(submission.review.registry, REVIEWED_BROWSER_TASK_SUBMISSION_REGISTRY);
  assert.equal(submission.review.goalCharacterCount, 27);
  assert.equal(submission.review.governance.explicitOperatorSubmission, true);
  assert.equal(submission.review.governance.actionsAccepted, false);
  assert.equal(submission.review.governance.startsExecution, false);
  assert.equal(submission.review.governance.callsProvider, false);
});

test("reviewed browser submission accepts bounded Unicode goals and local HTTP fixtures", () => {
  const submission = buildReviewedBrowserTaskSubmission({
    goal: "检查客户名称字段",
    targetUrl: "http://127.0.0.1:4321/form",
  });

  assert.equal(submission.taskInput.goal, "检查客户名称字段");
  assert.equal(submission.review.goalCharacterCount, 8);
  assert.equal(submission.taskInput.targetUrl, "http://127.0.0.1:4321/form");
  assert.equal(submission.taskInput.includePlan, false);
});

test("reviewed browser submission rejects caller authority and unsafe inputs", () => {
  const valid = { goal: "Inspect page", targetUrl: "https://example.com" };
  for (const body of [
    { ...valid, actions: [{ kind: "mouse.click" }] },
    { ...valid, policy: { intent: "host.mutate" } },
    { ...valid, includePlan: "yes" },
    { ...valid, goal: "line one\nline two" },
    { ...valid, goal: "x".repeat(401) },
    { ...valid, targetUrl: "file:///etc/passwd" },
    { ...valid, targetUrl: "https://user:secret@example.com" },
  ]) {
    assert.throws(() => buildReviewedBrowserTaskSubmission(body), /Reviewed browser task submission/u);
  }
});
