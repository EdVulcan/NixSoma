import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEyeHandRecoveryEvidence,
  createTaskRecovery,
  hasRecoverableCapabilityPlan,
  hasRecoverableBrowserPlan,
  hasRecoverableNativePluginRuntimeActivationPlan,
  hasRecoverableSearchWebAdapterPlan,
  isRecoverableTask,
} from "../src/task-recovery.mjs";

function createRecoveryHarness() {
  const tasks = new Map();
  const persisted = [];
  let nextTask = 1;
  let nextPlan = 1;
  const recovery = createTaskRecovery({
    tasks,
    persistState: () => persisted.push([...tasks.keys()]),
    now: () => "2026-01-02T03:04:05.000Z",
    createId: () => `id-${nextPlan++}`,
    createTask: (body) => {
      const task = {
        ...body,
        id: `task-${nextTask++}`,
        status: "queued",
        policy: body.policy ? { request: body.policy } : null,
        recoveredByTaskId: null,
      };
      tasks.set(task.id, task);
      return task;
    },
  });

  return { persisted, recovery, tasks };
}

test("task recovery preserves public recovered task contracts and resets deferred plans", () => {
  const { persisted, recovery, tasks } = createRecoveryHarness();
  const sourceTask = {
    id: "source-task",
    type: "openclaw_search_web_runtime_activation",
    goal: "Recover search web runtime activation",
    status: "failed",
    targetUrl: null,
    workViewStrategy: "openclaw-search-web-runtime-activation",
    policy: {
      request: {
        intent: "plugin.search_web.runtime_activation",
        approved: true,
      },
    },
    plan: {
      planId: "plan-old",
      strategy: "openclaw-search-web-runtime-activation-v0",
      status: "failed",
      createdAt: "old",
      updatedAt: "old",
      failure: { reason: "denied" },
      governance: {
        requiresRuntimeAdapterBeforeExecution: true,
        canUseNetwork: false,
        canExecutePluginCode: false,
      },
      steps: [
        {
          id: "step-1",
          status: "completed",
          completedAt: "old",
          details: { value: true },
        },
      ],
    },
    outcome: {
      kind: "failed",
      details: {
        recoveryEvidence: {
          kind: "eye-hand-recovery-evidence",
        },
      },
    },
    engineeringPlanTodoSuggestionLink: {
      registry: "openclaw-native-engineering-plan-todo-suggestion-link-v0",
      source: { taskId: "plan-task-1" },
    },
  };
  tasks.set(sourceTask.id, sourceTask);

  assert.equal(hasRecoverableSearchWebAdapterPlan(sourceTask), true);
  assert.equal(isRecoverableTask(sourceTask), true);

  const recovered = recovery.recoverTask(sourceTask);

  assert.equal(sourceTask.recoveredByTaskId, recovered.id);
  assert.equal(recovered.recovery.recoveredFromTaskId, sourceTask.id);
  assert.equal(recovered.recovery.recoveredFromOutcome, "failed");
  assert.equal(recovered.recovery.attempt, 1);
  assert.equal(recovered.engineeringPlanTodoSuggestionLink.source.taskId, "plan-task-1");
  assert.equal(recovered.plan.planId, "plan-id-1");
  assert.equal(recovered.plan.status, "planned");
  assert.equal(recovered.plan.createdAt, "2026-01-02T03:04:05.000Z");
  assert.equal(recovered.plan.updatedAt, "2026-01-02T03:04:05.000Z");
  assert.equal(recovered.plan.failure, undefined);
  assert.equal(recovered.plan.steps[0].status, "pending");
  assert.equal(recovered.plan.steps[0].completedAt, undefined);
  assert.equal(recovered.plan.steps[0].details, undefined);
  assert.equal(recovered.policy.request.approved, undefined);
  assert.equal(persisted.length, 1);
  assert.throws(() => recovery.recoverTask(sourceTask), /already has a recovery task/u);
});

test("task recovery classifies capability and native runtime plans", () => {
  const capabilityTask = {
    type: "system_task",
    status: "completed",
    plan: {
      steps: [
        {
          phase: "acting_on_target",
          capabilityId: "sense.system.vitals",
        },
      ],
    },
  };
  const nativeRuntimeTask = {
    type: "native_plugin_runtime_activation",
    status: "failed",
    plan: {
      strategy: "native-plugin-runtime-activation-v0",
      governance: {
        requiresRuntimeAdapterBeforeExecution: true,
        canReadSourceFileContent: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
      },
    },
  };

  assert.equal(hasRecoverableCapabilityPlan(capabilityTask), true);
  assert.equal(hasRecoverableNativePluginRuntimeActivationPlan(nativeRuntimeTask), true);
  assert.equal(isRecoverableTask({ ...capabilityTask, status: "queued" }), false);
});

test("task recovery preserves a failed browser rule plan after authority interruption", () => {
  const { recovery, tasks } = createRecoveryHarness();
  const sourceTask = {
    id: "browser-source",
    type: "browser_task",
    goal: "Recover browser work",
    status: "failed",
    targetUrl: "https://example.com/origin",
    plan: {
      planId: "plan-browser-old",
      strategy: "rule-v1",
      status: "failed",
      steps: [{
        id: "step-browser-new-tab",
        phase: "acting_on_target",
        kind: "browser.new_tab",
        params: { url: "https://example.com/recovered" },
        status: "completed",
        completedAt: "old",
      }, {
        id: "step-browser-second-tab",
        phase: "acting_on_target",
        kind: "browser.new_tab",
        params: { url: "https://example.com/still-pending" },
        status: "pending",
      }],
    },
    outcome: {
      kind: "failed",
      details: {
        recoveryEvidence: { kind: "work-view-authority-recovery-evidence" },
      },
    },
  };
  tasks.set(sourceTask.id, sourceTask);
  assert.equal(hasRecoverableBrowserPlan(sourceTask), true);

  const recovered = recovery.recoverTask(sourceTask);

  assert.equal(recovered.plan.strategy, "rule-v1");
  assert.equal(recovered.plan.steps[0].kind, "browser.new_tab");
  assert.equal(recovered.plan.steps[0].params.url, "https://example.com/recovered");
  assert.equal(recovered.plan.steps[0].status, "completed");
  assert.equal(recovered.plan.steps[0].completedAt, "old");
  assert.equal(recovered.plan.steps[1].status, "pending");
});

test("task recovery builds eye-hand evidence without exposing unrelated failures", () => {
  const evidence = buildEyeHandRecoveryEvidence(
    {
      id: "task-1",
      targetUrl: "https://example.test/before",
    },
    "Executor verification failed.",
    {
      targetUrl: "https://example.test/requested",
      verification: {
        failedChecks: [
          {
            name: "url",
            expected: "https://example.test/target",
            actual: "https://example.test/other",
          },
        ],
        actionEvidence: {
          observedAfterActions: {
            url: "https://example.test/other",
          },
        },
      },
    },
  );

  assert.equal(evidence.kind, "eye-hand-recovery-evidence");
  assert.equal(evidence.recommendation.strategy, "retry_with_fresh_observation");
  assert.equal(evidence.recommendation.targetUrl, "https://example.test/other");
  assert.equal(evidence.failedChecks[0].name, "url");
  assert.equal(buildEyeHandRecoveryEvidence({ id: "task-2" }, "No evidence", {}), null);
});

test("task recovery builds work-view authority interruption evidence", () => {
  const evidence = buildEyeHandRecoveryEvidence(
    { id: "authority-task", targetUrl: "https://example.com/work" },
    "Work-view authority unavailable during prepare",
    {
      targetUrl: "https://example.com/work",
      authorityInterruption: {
        kind: "work-view-authority-interruption",
        stage: "prepare",
        recoverable: true,
        automaticRestart: false,
        authorityRevoked: false,
        actionAuthority: "inactive",
        helperStatus: "stopped",
      },
    },
  );
  assert.equal(evidence.kind, "work-view-authority-recovery-evidence");
  assert.equal(evidence.interruption.stage, "prepare");
  assert.equal(evidence.interruption.authorityRevoked, false);
  assert.equal(evidence.interruption.actionAuthority, "inactive");
  assert.equal(evidence.recommendation.strategy, "restore_trusted_work_view_then_recover_task");
  assert.equal(evidence.recommendation.automaticRestart, false);
});
