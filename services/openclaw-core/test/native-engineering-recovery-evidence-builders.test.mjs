import test from "node:test";
import assert from "node:assert/strict";

import { buildNativeEngineeringRecoveryEvidence } from "../src/native-engineering-recovery-evidence-builders.mjs";

function recoverableSourceCommandTask({
  id = "task-failed-1",
  status = "failed",
  recoveredByTaskId = null,
  exitCode = 7,
} = {}) {
  return {
    id,
    status,
    type: "system_task",
    goal: "Run governed verification",
    recoveredByTaskId,
    sourceCommand: {
      registry: "openclaw-source-command-task-v0",
      proposalId: "openclaw:typecheck",
    },
    plan: {
      strategy: "source-command-proposal-v0",
      steps: [{
        phase: "acting_on_target",
        capabilityId: "act.system.command.execute",
        status: "completed",
      }],
    },
    outcome: {
      kind: "failed",
      details: {
        failedCommand: {
          exitCode,
          timedOut: false,
          stdout: "verification stdout",
          stderr: "verification stderr",
        },
      },
    },
  };
}

test("native engineering recovery evidence recommends governed review for failed verification", () => {
  const task = recoverableSourceCommandTask();
  const response = buildNativeEngineeringRecoveryEvidence({
    verificationEvidence: {
      registry: "openclaw-native-engineering-verification-evidence-v0",
      evidence: [{
        ok: false,
        taskId: task.id,
        transcriptIndex: 0,
        taskStatus: "failed",
        taskOutcome: "failed",
        sourceCommand: task.sourceCommand,
        commandShape: { command: "npm", cwd: "/tmp/openclaw" },
        result: {
          exitCode: 7,
          timedOut: false,
          stdout: "verification stdout",
          stderr: "verification stderr",
          outputTruncated: false,
        },
        validation: {
          failedChecks: [{ name: "exit_code_zero", ok: false, evidence: "7" }],
        },
      }],
    },
    tasks: new Map([[task.id, task]]),
    taskId: task.id,
  });

  assert.equal(response.ok, true);
  assert.equal(response.registry, "openclaw-native-engineering-recovery-evidence-v0");
  assert.equal(response.capability.id, "sense.openclaw.engineering_tool.recovery_evidence");
  assert.equal(response.governance.canCreateRecoveryTask, false);
  assert.equal(response.governance.canApproveRecovery, false);
  assert.equal(response.governance.canExecuteCommand, false);
  assert.equal(response.governance.canMutate, false);
  assert.equal(response.summary.totalFailures, 1);
  assert.equal(response.summary.recoverableFailures, 1);
  assert.equal(response.failures[0].kind, "verification_command_exit_nonzero");
  assert.equal(response.failures[0].recoverable, true);
  assert.equal(response.failures[0].recommendations.some((item) => item.id === "recover_task_after_review"), true);
  assert.equal(response.deferredExecutionBoundaries.includes("no command execution"), true);
});

test("native engineering recovery evidence marks already recovered tasks without creating another task path", () => {
  const task = recoverableSourceCommandTask({
    id: "task-recovered-1",
    recoveredByTaskId: "task-recovery-2",
  });
  const response = buildNativeEngineeringRecoveryEvidence({
    verificationEvidence: { evidence: [] },
    tasks: [task],
    taskId: task.id,
  });

  assert.equal(response.summary.totalFailures, 1);
  assert.equal(response.summary.alreadyRecovered, 1);
  assert.equal(response.failures[0].source, "failed_task");
  assert.equal(response.failures[0].alreadyRecovered, true);
  assert.equal(response.failures[0].recoveredByTaskId, "task-recovery-2");
  assert.equal(
    response.failures[0].recommendations.some((item) => item.id === "recover_task_after_review"),
    false,
  );
  assert.equal(
    response.failures[0].recommendations.some((item) => item.id === "inspect_existing_recovery_task"),
    true,
  );
});

test("native engineering recovery evidence filters task id and preserves read-only governance", () => {
  const selected = recoverableSourceCommandTask({ id: "task-selected" });
  const other = recoverableSourceCommandTask({ id: "task-other" });
  const response = buildNativeEngineeringRecoveryEvidence({
    verificationEvidence: { evidence: [] },
    tasks: new Map([[selected.id, selected], [other.id, other]]),
    taskId: selected.id,
    limit: 999,
  });

  assert.equal(response.query.limit, 50);
  assert.equal(response.summary.totalFailures, 1);
  assert.equal(response.failures[0].taskId, selected.id);
  assert.equal(response.bounds.noRecoveryTaskCreation, true);
  assert.equal(response.bounds.noApprovalCreation, true);
  assert.equal(response.bounds.noCommandExecution, true);
  assert.equal(response.auditEvidence.operation, "recovery_evidence");
});
