import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBoundedOperatorRunResumeRequest,
  createOperatorRunSessionManager,
} from "../src/operator-run-session.mjs";

function createHarness() {
  const records = new Map();
  let persistCount = 0;
  let tick = 0;
  const manager = createOperatorRunSessionManager({
    records,
    persistState: () => { persistCount += 1; },
    now: () => `2026-08-01T12:00:${String(tick++).padStart(2, "0")}.000Z`,
  });
  return { manager, records, get persistCount() { return persistCount; } };
}

test("bounded operator session checkpoints steps and keeps resume explicit", () => {
  const harness = createHarness();
  const session = harness.manager.create({ maxSteps: 3 });

  harness.manager.markStep(session.id, "task-1");
  harness.manager.finish(session.id, { blocked: true, reason: "policy_requires_approval" });

  const blocked = harness.manager.publicById(session.id);
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.stepsCompleted, 1);
  assert.equal(blocked.remainingSteps, 2);
  assert.equal(blocked.lastTaskId, "task-1");
  assert.equal(blocked.resumeAvailable, true);
  assert.equal(blocked.governance.automaticResume, false);
  assert.equal(blocked.governance.automaticRetry, false);

  const resumed = harness.manager.beginResume(session.id);
  assert.equal(resumed.remainingSteps, 2);
  assert.equal(resumed.resumeCount, 1);
  assert.equal(resumed.status, "running");
  assert.equal(harness.persistCount > 0, true);

  harness.manager.markStep(session.id, "task-2");
  harness.manager.markStep(session.id, "task-3");
  harness.manager.finish(session.id, { ran: true });

  const completed = harness.manager.publicById(session.id);
  assert.equal(completed.status, "completed");
  assert.equal(completed.remainingSteps, 0);
  assert.equal(completed.resumeAvailable, false);
});

test("startup turns an unfinished run into an explicitly resumable interruption", () => {
  const harness = createHarness();
  const session = harness.manager.create({ maxSteps: 2 });
  harness.manager.markStep(session.id, "task-before-restart");

  const restored = harness.manager.reconcileInterruptedAtStartup();
  assert.equal(restored[0].id, session.id);
  assert.equal(restored[0].status, "interrupted");
  assert.equal(restored[0].stopReason, "core_restart");
  assert.equal(restored[0].remainingSteps, 1);
  assert.equal(restored[0].resumeAvailable, true);
});

test("an interrupted task blocks Resume until the operator creates an explicit recovery task", () => {
  const harness = createHarness();
  const session = harness.manager.create({ maxSteps: 2 });
  harness.manager.markTaskStarted(session.id, { id: "task-in-flight" });
  harness.manager.reconcileInterruptedAtStartup();

  const interrupted = harness.manager.markTaskInterrupted(
    { id: "task-in-flight", status: "failed", executionPhase: "acting_on_target" },
    { recoverable: true },
  )[0];
  assert.equal(interrupted.recovery.required, true);
  assert.equal(interrupted.recovery.recoverable, true);
  assert.equal(interrupted.resumeAvailable, false);
  assert.throws(
    () => harness.manager.beginResume(session.id),
    /requires explicit task recovery first/u,
  );

  const recovered = harness.manager.markTaskRecovered("task-in-flight", "task-recovery")[0];
  assert.equal(recovered.recovery.required, false);
  assert.equal(recovered.recovery.recoveredTaskId, "task-recovery");
  assert.equal(recovered.resumeAvailable, true);
});

test("a completed task checkpoint is counted once after Core restart", () => {
  const harness = createHarness();
  const session = harness.manager.create({ maxSteps: 2 });
  harness.manager.markTaskStarted(session.id, { id: "task-completed" });
  harness.manager.reconcileInterruptedAtStartup();

  const restored = harness.manager.reconcileCompletedTaskCheckpoint(session.id, {
    id: "task-completed",
    status: "completed",
  });
  assert.equal(restored.stepsCompleted, 1);
  assert.equal(restored.remainingSteps, 1);
  assert.equal(restored.resumeAvailable, true);
  assert.equal(harness.manager.reconcileCompletedTaskCheckpoint(session.id, {
    id: "task-completed",
    status: "completed",
  }), null);
});

test("resume request accepts only an explicit session confirmation", () => {
  const request = buildBoundedOperatorRunResumeRequest({ sessionId: "run-session-1", confirm: true });
  assert.deepEqual(request.request, { sessionId: "run-session-1", confirm: true });
  assert.equal(request.resume.status, "resume_requested");
  assert.equal(request.resume.governance.automaticResume, false);

  for (const body of [
    { sessionId: "run-session-1" },
    { sessionId: "run-session-1", confirm: false },
    { sessionId: "run-session-1", confirm: true, maxSteps: 20 },
    { sessionId: "../run-session", confirm: true },
  ]) {
    assert.throws(() => buildBoundedOperatorRunResumeRequest(body), /Bounded operator resume/u);
  }
});

test("public session evidence strips task, action, provider, and input content", () => {
  const harness = createHarness();
  const session = harness.manager.create({ maxSteps: 2 });
  Object.assign(harness.records.get(session.id), {
    goal: "private task goal",
    actions: [{ kind: "keyboard.type", params: { text: "private input" } }],
    providerContent: "private provider response",
    inputText: "private input",
  });

  const publicEvidence = harness.manager.publicById(session.id);
  for (const field of ["goal", "actions", "providerContent", "inputText"]) {
    assert.equal(Object.hasOwn(publicEvidence, field), false, `public session exposed ${field}`);
  }
  assert.equal(publicEvidence.requestedSteps, 2);
  assert.equal(publicEvidence.governance.mutatesHost, false);
});
