import test from "node:test";
import assert from "node:assert/strict";

import { createPromptPackCapabilityHandlers } from "../src/capability-runtime-prompt-pack.mjs";

const capability = { id: "sense.openclaw.prompt_pack" };

test("prompt pack capability delegates bounded inputs and emits a governance summary", () => {
  const calls = [];
  const handlers = createPromptPackCapabilityHandlers({
    buildNativeOpenClawPromptSemanticsProfile: (input) => {
      calls.push(input);
      return {
        ok: true,
        registry: "openclaw-native-prompt-semantics-v0",
        summary: {
          totalFiles: 2,
          contentRead: 2,
          expectedChecks: ["diff-preview", "approval-required", "test"],
          workStandardsStatus: "ready_for_engineering_loop_guidance",
          workStandardsSatisfied: 7,
          workStandardsRequired: 7,
          exposesPromptContent: false,
        },
        workStandards: {
          status: "ready_for_engineering_loop_guidance",
          score: { satisfied: 7, required: 7 },
        },
        governance: {
          exposesPromptContent: false,
          exposesSourceFileContent: false,
          canExecutePromptCode: false,
          canExecuteToolCode: false,
          canCallProvider: false,
          canUseNetwork: false,
          canMutate: false,
          createsTask: false,
          createsApproval: false,
        },
      };
    },
  });

  const backend = handlers.callBackend(capability, {
    params: {
      workspacePath: "/tmp/openclaw-fixture",
      q: "verify",
      limit: 12,
    },
  });

  assert.equal(backend.handled, true);
  assert.deepEqual(calls, [{
    workspacePath: "/tmp/openclaw-fixture",
    query: "verify",
    limit: 12,
  }]);
  assert.deepEqual(handlers.summariseResult(capability, backend.result), {
    kind: "openclaw.prompt_pack",
    ok: true,
    registry: "openclaw-native-prompt-semantics-v0",
    totalFiles: 2,
    contentRead: 2,
    expectedChecks: 3,
    workStandardsStatus: "ready_for_engineering_loop_guidance",
    workStandardsSatisfied: 7,
    workStandardsRequired: 7,
    noPromptContentExposure: true,
    noPromptExecution: true,
    noMutation: true,
    noTaskCreation: true,
    noApprovalCreation: true,
    noProviderEgress: true,
  });
});

test("prompt pack handler leaves unrelated capabilities untouched", () => {
  const handlers = createPromptPackCapabilityHandlers({
    buildNativeOpenClawPromptSemanticsProfile: () => ({ ok: true }),
  });

  assert.deepEqual(handlers.callBackend({ id: "sense.system.vitals" }, { params: {} }), {
    handled: false,
    result: null,
  });
  assert.equal(handlers.summariseResult({ id: "sense.system.vitals" }, {}), null);
});
