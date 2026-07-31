import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBoundedOperatorRunRequest,
  OPERATOR_RUN_MAXIMUM_STEPS,
  OPERATOR_RUN_REQUEST_REGISTRY,
} from "../src/operator-run-request.mjs";

test("bounded operator run accepts only an explicit finite session", () => {
  const boundedRun = buildBoundedOperatorRunRequest({ maxSteps: 7, dryRun: true });

  assert.deepEqual(boundedRun.request, { maxSteps: 7, dryRun: true });
  assert.deepEqual(boundedRun.session, {
    registry: OPERATOR_RUN_REQUEST_REGISTRY,
    status: "previewed",
    maximumSteps: 7,
    dryRun: true,
    governance: {
      explicitOperatorTrigger: true,
      taskOverridesAccepted: false,
      backgroundScheduling: false,
      automaticRepeat: false,
      automaticRetry: false,
      openLoop: false,
      createsTask: false,
      createsApproval: false,
      callsProvider: false,
      mutatesHost: false,
    },
  });
});

test("bounded operator run defaults only the optional dry-run flag", () => {
  const boundedRun = buildBoundedOperatorRunRequest({ maxSteps: OPERATOR_RUN_MAXIMUM_STEPS });

  assert.deepEqual(boundedRun.request, { maxSteps: 20, dryRun: false });
  assert.equal(boundedRun.session.status, "run_requested");
  assert.equal(boundedRun.session.maximumSteps, 20);
});

test("bounded operator run rejects invalid limits and caller authority", () => {
  for (const body of [
    null,
    [],
    {},
    { maxSteps: 0 },
    { maxSteps: 21 },
    { maxSteps: 1.5 },
    { maxSteps: "5" },
    { maxSteps: 5, dryRun: "true" },
    { maxSteps: 5, actions: [] },
    { maxSteps: 5, taskId: "task-1" },
    { maxSteps: 5, targetUrl: "https://example.com" },
    { maxSteps: 5, policy: { decision: "allow" } },
  ]) {
    assert.throws(() => buildBoundedOperatorRunRequest(body), /Bounded operator run/u);
  }
});
