import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createBodyEvidenceReadinessBuilders } from "../src/body-evidence-readiness-builders.mjs";

function createFollowupTask(overrides = {}) {
  const {
    bodyEvidenceLedgerFollowupRecord: followupRecordOverrides = {},
    ...taskOverrides
  } = overrides;
  return {
    id: "body-evidence-followup-task",
    type: "body_evidence_ledger_followup_record_task",
    status: "queued",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
    approval: {
      requestId: "approval-followup",
      status: "pending",
    },
    plan: {
      steps: [
        {
          id: "defer-followup-record-append",
          phase: "deferred_followup_record_append",
          title: "Defer follow-up append",
          executesNow: false,
        },
      ],
    },
    bodyEvidenceLedgerFollowupRecord: {
      registry: "openclaw-body-evidence-ledger-followup-record-task-v0",
      sourceRegistry: "openclaw-body-evidence-ledger-followup-record-plan-v0",
      plannedRecordType: "body_evidence_timeline_followup",
      plannedSequence: 2,
      appendExecutionEnabled: false,
      recordAppended: false,
      durableStorageWritten: false,
      ...followupRecordOverrides,
    },
    ...taskOverrides,
  };
}

function writeLedger(filePath, records) {
  writeFileSync(filePath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

function createHarness({ records = [], task = createFollowupTask(), routeSlice = "openclaw-body-evidence-ledger-followup-record-append-route-review" } = {}) {
  const tempDir = mkdtempSync(path.join(tmpdir(), "openclaw-body-evidence-readiness-test-"));
  const ledgerFile = path.join(tempDir, "body-evidence-ledger.jsonl");
  if (records.length > 0) {
    writeLedger(ledgerFile, records);
  }
  const tasks = new Map(task ? [[task.id, task]] : []);
  const approvals = new Map([
    ["approval-followup", { id: "approval-followup", status: "pending" }],
  ]);
  const events = [];
  const calls = [];
  const builders = createBodyEvidenceReadinessBuilders({
    tasks,
    approvals,
    getTaskById: (taskId) => tasks.get(taskId) ?? null,
    persistState: () => calls.push({ name: "persistState" }),
    publishEvent: async (name, body) => events.push({ name, body }),
    serialiseTask: (candidate) => ({
      id: candidate.id,
      type: candidate.type,
      status: candidate.status,
      approval: candidate.approval ?? null,
      bodyEvidenceLedgerFollowupRecord: candidate.bodyEvidenceLedgerFollowupRecord ?? null,
    }),
    buildPhase2NextCapabilityRouteReview: async () => ({
      ok: true,
      registry: "openclaw-phase-2-next-capability-route-review-v0",
      decision: {
        selectedSlice: routeSlice,
      },
      next: {
        recommendedSlice: routeSlice,
      },
    }),
    ledgerFileDisplayPath: "body-evidence-ledger.jsonl",
    resolveLedgerFilePath: () => ledgerFile,
  });

  return {
    tempDir,
    ledgerFile,
    tasks,
    task,
    events,
    calls,
    builders,
    cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
  };
}

test("body evidence readiness builders report pending follow-up task readiness without enabling append", () => {
  const harness = createHarness({
    records: [
      {
        id: "body-evidence-record-1",
        evidenceType: "body_evidence_timeline",
        contentHash: "hash-record-1",
      },
    ],
  });

  try {
    const readiness = harness.builders.buildBodyEvidenceLedgerFollowupRecordReadiness();

    assert.equal(readiness.registry, "openclaw-body-evidence-ledger-followup-record-readiness-v0");
    assert.equal(readiness.summary.ready, true);
    assert.equal(readiness.summary.existingRecordCount, 1);
    assert.equal(readiness.summary.recordAppended, false);
    assert.equal(readiness.governance.canAppendLedgerRecord, false);
    assert.equal(readiness.evidence.task.id, "body-evidence-followup-task");
  } finally {
    harness.cleanup();
  }
});

test("body evidence readiness builders select append route review and arm append explicitly", async () => {
  const harness = createHarness({
    records: [
      {
        id: "body-evidence-record-1",
        evidenceType: "body_evidence_timeline",
        contentHash: "hash-record-1",
      },
    ],
  });

  try {
    const routeReview = await harness.builders.buildBodyEvidenceLedgerFollowupRecordAppendRouteReview();

    assert.equal(routeReview.registry, "openclaw-body-evidence-ledger-followup-record-append-route-review-v0");
    assert.equal(routeReview.status, "selected");
    assert.equal(routeReview.decision.selectedSlice, "openclaw-body-evidence-ledger-followup-record-append");
    assert.equal(routeReview.summary.existingRecordCount, 1);

    await assert.rejects(
      () => harness.builders.armBodyEvidenceLedgerFollowupRecordAppend({ confirm: false }),
      /requires confirm=true/,
    );

    const armed = await harness.builders.armBodyEvidenceLedgerFollowupRecordAppend({
      confirm: true,
      taskId: "body-evidence-followup-task",
    });

    assert.equal(armed.registry, "openclaw-body-evidence-ledger-followup-record-append-v0");
    assert.equal(armed.task.bodyEvidenceLedgerFollowupRecord.appendExecutionEnabled, true);
    assert.equal(armed.task.plan.strategy, "approval-gated-ledger-followup-record-append");
    assert.equal(armed.task.plan.steps[0].phase, "approved_followup_record_append");
    assert.equal(harness.calls.at(-1).name, "persistState");
    assert.equal(harness.events.at(-1).name, "body_evidence_ledger.followup_record_append_armed");
  } finally {
    harness.cleanup();
  }
});

test("body evidence readiness builders keep route review blocked when next route selects a different slice", async () => {
  const harness = createHarness({
    routeSlice: "openclaw-systemd-next-repair-scope-review",
    records: [
      {
        id: "body-evidence-record-1",
        evidenceType: "body_evidence_timeline",
        contentHash: "hash-record-1",
      },
    ],
  });

  try {
    const routeReview = await harness.builders.buildBodyEvidenceLedgerFollowupRecordAppendRouteReview();

    assert.equal(routeReview.status, "blocked_until_followup_readiness_route");
    assert.equal(routeReview.decision.selectedSlice, "wait-for-followup-readiness-route");
    await assert.rejects(
      () => harness.builders.armBodyEvidenceLedgerFollowupRecordAppend({ confirm: true }),
      /requires a selected append route review/,
    );
  } finally {
    harness.cleanup();
  }
});

test("body evidence readiness builders report append readiness after the second durable record", () => {
  const task = createFollowupTask({
    status: "completed",
    bodyEvidenceLedgerFollowupRecord: {
      appendExecutionEnabled: true,
      recordAppended: true,
      durableStorageWritten: true,
      recordId: "body-evidence-record-2",
      previousRecordId: "body-evidence-record-1",
      previousRecordHash: "hash-record-1",
      contentHash: "hash-record-2",
    },
    outcome: {
      details: {
        scheduler: false,
        backgroundWriter: false,
        bulkImport: false,
      },
    },
  });
  const harness = createHarness({
    task,
    records: [
      {
        id: "body-evidence-record-1",
        evidenceType: "body_evidence_timeline",
        contentHash: "hash-record-1",
      },
      {
        id: "body-evidence-record-2",
        evidenceType: "body_evidence_timeline_followup",
        contentHash: "hash-record-2",
      },
    ],
  });

  try {
    const readiness = harness.builders.buildBodyEvidenceLedgerFollowupRecordAppendReadiness();

    assert.equal(readiness.registry, "openclaw-body-evidence-ledger-followup-record-append-readiness-v0");
    assert.equal(readiness.summary.ready, true);
    assert.equal(readiness.summary.existingRecordCount, 2);
    assert.equal(readiness.evidence.secondRecord.id, "body-evidence-record-2");
    assert.equal(readiness.governance.schedulesFollowUp, false);
  } finally {
    harness.cleanup();
  }
});
