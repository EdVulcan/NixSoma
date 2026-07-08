import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const BODY_EVIDENCE_LEDGER_FILE_DISPLAY_PATH =
  ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl";

function taskTimeForBodyEvidence(task) {
  const value = Date.parse(task?.closedAt ?? task?.updatedAt ?? task?.createdAt ?? "");
  return Number.isFinite(value) ? value : 0;
}

function isBodyEvidenceLedgerFollowupRecordTask(task) {
  return task?.type === "body_evidence_ledger_followup_record_task"
    && task?.bodyEvidenceLedgerFollowupRecord?.registry === "openclaw-body-evidence-ledger-followup-record-task-v0";
}

export function createBodyEvidenceReadinessBuilders(deps) {
  const {
    tasks,
    approvals,
    getTaskById,
    persistState,
    publishEvent,
    serialiseTask,
    buildPhase2NextCapabilityRouteReview,
    ledgerFileDisplayPath = BODY_EVIDENCE_LEDGER_FILE_DISPLAY_PATH,
    resolveLedgerFilePath = (displayPath) => path.resolve(process.cwd(), "../..", displayPath),
  } = deps;

  function findLatestBodyEvidenceLedgerFollowupRecordTask() {
    return [...tasks.values()]
      .filter((task) => task.type === "body_evidence_ledger_followup_record_task")
      .filter((task) => task.bodyEvidenceLedgerFollowupRecord?.registry === "openclaw-body-evidence-ledger-followup-record-task-v0")
      .sort((left, right) => taskTimeForBodyEvidence(right) - taskTimeForBodyEvidence(left))[0]
      ?? null;
  }

  function readBodyEvidenceLedgerLines() {
    const ledgerFilePath = resolveLedgerFilePath(ledgerFileDisplayPath);
    if (!existsSync(ledgerFilePath)) {
      return {
        ledgerFileDisplayPath,
        ledgerFilePath,
        exists: false,
        lineCount: 0,
        records: [],
      };
    }
    const text = readFileSync(ledgerFilePath, "utf8");
    const lines = text.trim() ? text.trim().split("\n").filter(Boolean) : [];
    return {
      ledgerFileDisplayPath,
      ledgerFilePath,
      exists: true,
      lineCount: lines.length,
      records: lines.map((line, index) => {
        try {
          const record = JSON.parse(line);
          return {
            index,
            ok: true,
            id: record.id ?? null,
            evidenceType: record.evidenceType ?? null,
            sourceRegistry: record.sourceRegistry ?? null,
            contentHash: record.contentHash ?? null,
          };
        } catch (error) {
          return {
            index,
            ok: false,
            error: error instanceof Error ? error.message : "Invalid JSONL record",
          };
        }
      }),
    };
  }

  function buildBodyEvidenceLedgerFollowupRecordReadiness() {
    const latestTask = findLatestBodyEvidenceLedgerFollowupRecordTask();
    const followupRecord = latestTask?.bodyEvidenceLedgerFollowupRecord ?? null;
    const ledger = readBodyEvidenceLedgerLines();
    const checklist = [
      {
        id: "followup-task-shell",
        label: "Follow-up ledger record task shell exists",
        status: latestTask?.type === "body_evidence_ledger_followup_record_task" ? "passed" : "pending",
        evidence: latestTask?.id ?? null,
      },
      {
        id: "pending-approval-boundary",
        label: "Follow-up task remains approval-gated before append execution",
        status: latestTask?.approval?.status === "pending" && followupRecord?.appendExecutionEnabled === false ? "passed" : "pending",
        evidence: latestTask?.approval?.requestId ?? latestTask?.approval?.id ?? null,
      },
      {
        id: "planned-second-record",
        label: "Task shell targets planned sequence 2 follow-up timeline record",
        status: followupRecord?.plannedRecordType === "body_evidence_timeline_followup"
          && followupRecord?.plannedSequence === 2 ? "passed" : "pending",
        evidence: followupRecord?.sourceRegistry ?? null,
      },
      {
        id: "no-second-ledger-record",
        label: "Ledger still contains exactly one durable record",
        status: ledger.exists === true && ledger.lineCount === 1 ? "passed" : "pending",
        evidence: ledger.ledgerFileDisplayPath,
      },
      {
        id: "no-hidden-writer",
        label: "No scheduler, background writer, command execution, or host mutation is enabled",
        status: followupRecord?.recordAppended === false
          && followupRecord?.durableStorageWritten === false
          && latestTask?.status === "queued" ? "passed" : "pending",
        evidence: "followup_record_readiness_governance",
      },
    ];
    const passedChecks = checklist.filter((item) => item.status === "passed").length;
    const ready = passedChecks === checklist.length;

    return {
      ok: true,
      registry: "openclaw-body-evidence-ledger-followup-record-readiness-v0",
      mode: "read_only_followup_record_task_readiness",
      generatedAt: new Date().toISOString(),
      status: ready ? "ready_for_route_review" : "waiting_for_followup_task_shell",
      source: {
        service: "openclaw-core",
        taskId: latestTask?.id ?? null,
        taskRegistry: followupRecord?.registry ?? null,
        ledgerFile: ledger.ledgerFileDisplayPath,
        evidence: "body_evidence_ledger_followup_record_readiness",
      },
      checklist,
      summary: {
        ready,
        passedChecks,
        totalChecks: checklist.length,
        taskId: latestTask?.id ?? null,
        approvalId: latestTask?.approval?.requestId ?? latestTask?.approval?.id ?? null,
        approvalStatus: latestTask?.approval?.status ?? null,
        plannedRecordType: followupRecord?.plannedRecordType ?? null,
        plannedSequence: followupRecord?.plannedSequence ?? null,
        existingRecordCount: ledger.lineCount,
        recordAppended: followupRecord?.recordAppended === true,
        durableStorageWritten: followupRecord?.durableStorageWritten === true,
        hiddenMutation: false,
      },
      evidence: {
        task: latestTask ? serialiseTask(latestTask) : null,
        followupRecord,
        ledger,
        noSecondRecord: ledger.lineCount === 1,
        hardBoundary: [
          "do not approve follow-up append in this checkpoint",
          "do not append a second ledger record",
          "no scheduler",
          "no background writer",
          "no command execution",
          "no host mutation",
        ],
      },
      governance: {
        readsTaskHistoryOnly: true,
        createsTask: false,
        createsApproval: false,
        executesCommand: false,
        hostMutation: false,
        canAppendLedgerRecord: false,
        canWriteLedger: false,
        recordAppended: false,
        durableStorageWritten: false,
        triggersRecovery: false,
        schedulesFollowUp: false,
        backgroundWriter: false,
        bulkImport: false,
      },
      next: {
        recommendedSlice: "openclaw-phase-2-next-capability-route-review",
        boundary: "return to whitepaper route review before approving the follow-up append, writing a second ledger record, or adding background persistence",
      },
    };
  }

  async function buildBodyEvidenceLedgerFollowupRecordAppendRouteReview() {
    const readiness = buildBodyEvidenceLedgerFollowupRecordReadiness();
    const routeReview = await buildPhase2NextCapabilityRouteReview();
    const ready = readiness.summary?.ready === true
      && routeReview.decision?.selectedSlice === "openclaw-body-evidence-ledger-followup-record-append-route-review"
      && readiness.summary?.recordAppended === false
      && readiness.summary?.existingRecordCount === 1;
    const checklist = [
      {
        id: "followup-readiness-ready",
        label: "Follow-up task readiness is complete",
        status: readiness.summary?.ready === true ? "passed" : "pending",
        evidence: readiness.registry,
      },
      {
        id: "route-selected",
        label: "Next capability route selected follow-up append route review",
        status: routeReview.decision?.selectedSlice === "openclaw-body-evidence-ledger-followup-record-append-route-review" ? "passed" : "pending",
        evidence: routeReview.registry,
      },
      {
        id: "pending-approval",
        label: "Existing follow-up task remains pending approval",
        status: readiness.summary?.approvalStatus === "pending" ? "passed" : "pending",
        evidence: readiness.summary?.approvalId ?? null,
      },
      {
        id: "no-second-record",
        label: "Ledger still contains exactly one durable record",
        status: readiness.summary?.existingRecordCount === 1 && readiness.summary?.recordAppended === false ? "passed" : "pending",
        evidence: readiness.source?.ledgerFile ?? null,
      },
      {
        id: "review-only",
        label: "Route review creates no task, approval, append, scheduler, or host mutation",
        status: "passed",
        evidence: "followup_append_route_review_governance",
      },
    ];
    const passedChecks = checklist.filter((item) => item.status === "passed").length;

    return {
      ok: true,
      registry: "openclaw-body-evidence-ledger-followup-record-append-route-review-v0",
      mode: "read_only_followup_append_route_review",
      generatedAt: new Date().toISOString(),
      status: ready ? "selected" : "blocked_until_followup_readiness_route",
      source: {
        service: "openclaw-core",
        readinessRegistry: readiness.registry,
        nextCapabilityRouteRegistry: routeReview.registry,
        evidence: "body_evidence_ledger_followup_append_route_review",
      },
      decision: {
        selectedTrack: "Track C: Body Evidence Memory",
        selectedSlice: ready ? "openclaw-body-evidence-ledger-followup-record-append" : "wait-for-followup-readiness-route",
        status: ready ? "selected" : "blocked",
        rationale: ready
          ? "The follow-up ledger task is visible and pending; a future append execution may be opened only as a separate approved milestone."
          : "The follow-up append route waits for readiness plus next-capability route selection.",
        notSelected: [
          "no approval in route review",
          "no second ledger record append in route review",
          "no background ledger writer",
          "no scheduler",
          "no automatic repair",
          "no plugin/runtime adapter work",
          "no arbitrary host control",
        ],
      },
      checklist,
      summary: {
        ready,
        passedChecks,
        totalChecks: checklist.length,
        taskId: readiness.summary?.taskId ?? null,
        approvalId: readiness.summary?.approvalId ?? null,
        approvalStatus: readiness.summary?.approvalStatus ?? null,
        plannedRecordType: readiness.summary?.plannedRecordType ?? null,
        plannedSequence: readiness.summary?.plannedSequence ?? null,
        existingRecordCount: readiness.summary?.existingRecordCount ?? 0,
        recordAppended: false,
        durableStorageWritten: false,
      },
      governance: {
        readOnly: true,
        createsTask: false,
        createsApproval: false,
        approvesTask: false,
        executesCommand: false,
        hostMutation: false,
        canAppendLedgerRecord: false,
        recordAppended: false,
        durableStorageWritten: false,
        schedulesFollowUp: false,
        backgroundWriter: false,
        triggersRecovery: false,
      },
      evidence: {
        readiness,
        routeReview: {
          registry: routeReview.registry,
          selectedSlice: routeReview.decision?.selectedSlice ?? null,
          recommendedSlice: routeReview.next?.recommendedSlice ?? null,
        },
        noSecondRecord: readiness.evidence?.noSecondRecord === true,
      },
      next: {
        recommendedSlice: ready ? "openclaw-body-evidence-ledger-followup-record-append" : "openclaw-body-evidence-ledger-followup-record-readiness",
        boundary: "future append must be a separate approved execution milestone; do not approve or write JSONL in this route review",
      },
    };
  }

  async function armBodyEvidenceLedgerFollowupRecordAppend({ confirm = false, taskId = null } = {}) {
    if (confirm !== true) {
      throw new Error("Body evidence ledger follow-up append requires confirm=true.");
    }

    const routeReview = await buildBodyEvidenceLedgerFollowupRecordAppendRouteReview();
    if (routeReview.status !== "selected"
      || routeReview.decision?.selectedSlice !== "openclaw-body-evidence-ledger-followup-record-append"
      || routeReview.summary?.existingRecordCount !== 1
      || routeReview.summary?.recordAppended !== false) {
      throw new Error("Body evidence ledger follow-up append requires a selected append route review.");
    }

    const task = taskId ? getTaskById(taskId) : findLatestBodyEvidenceLedgerFollowupRecordTask();
    if (!task || !isBodyEvidenceLedgerFollowupRecordTask(task)) {
      throw new Error("Follow-up ledger record append requires an existing follow-up record task.");
    }
    if (task.id !== routeReview.summary?.taskId) {
      throw new Error("Follow-up ledger record append task must match the selected route-review task.");
    }
    if (task.approval?.status !== "pending" && task.approval?.status !== "approved") {
      throw new Error("Follow-up ledger record append requires a pending or approved task approval.");
    }

    task.bodyEvidenceLedgerFollowupRecord = {
      ...(task.bodyEvidenceLedgerFollowupRecord ?? {}),
      appendExecutionEnabled: true,
      appendRouteReviewRegistry: routeReview.registry,
      appendRouteReviewSelectedAt: routeReview.generatedAt,
      futureAppendRequiresSeparateMilestone: false,
    };
    task.plan = {
      ...(task.plan ?? {}),
      strategy: "approval-gated-ledger-followup-record-append",
      summary: "Execute the approved second body evidence ledger JSONL append for the existing follow-up record task.",
      steps: (task.plan?.steps ?? []).map((step) => {
        if (step.id === "defer-followup-record-append") {
          return {
            ...step,
            phase: "approved_followup_record_append",
            title: "Append the second JSONL record after explicit approval",
            executesNow: true,
          };
        }
        return step;
      }),
    };
    task.updatedAt = new Date().toISOString();
    persistState();
    await publishEvent(createEventName("body_evidence_ledger.followup_record_append_armed"), {
      task: serialiseTask(task),
      routeReview: {
        registry: routeReview.registry,
        selectedSlice: routeReview.decision?.selectedSlice ?? null,
      },
    });

    return {
      registry: "openclaw-body-evidence-ledger-followup-record-append-v0",
      mode: "approval-gated-followup-record-append-armed",
      generatedAt: new Date().toISOString(),
      routeReview,
      task,
      approval: task.approval?.requestId ? approvals.get(task.approval.requestId) : null,
      governance: {
        createsTask: false,
        createsApproval: false,
        requiresExplicitApproval: true,
        canAppendLedgerRecord: true,
        appendExecutionEnabled: true,
        recordAppended: false,
        durableStorageWritten: false,
        hostMutation: false,
        schedulesFollowUp: false,
        backgroundWriter: false,
        bulkImport: false,
      },
    };
  }

  function buildBodyEvidenceLedgerFollowupRecordAppendReadiness() {
    const latestTask = findLatestBodyEvidenceLedgerFollowupRecordTask();
    const followupRecord = latestTask?.bodyEvidenceLedgerFollowupRecord ?? null;
    const ledger = readBodyEvidenceLedgerLines();
    const firstRecord = ledger.records?.[0] ?? null;
    const secondRecord = ledger.records?.[1] ?? null;
    const checklist = [
      {
        id: "followup-task-completed",
        label: "Follow-up ledger append task completed",
        status: latestTask?.status === "completed" && followupRecord?.recordAppended === true ? "passed" : "pending",
        evidence: latestTask?.id ?? null,
      },
      {
        id: "two-ledger-records",
        label: "Ledger contains exactly two durable JSONL records",
        status: ledger.exists === true && ledger.lineCount === 2 ? "passed" : "pending",
        evidence: ledger.ledgerFileDisplayPath,
      },
      {
        id: "followup-record-type",
        label: "Second record is the planned follow-up timeline record",
        status: secondRecord?.evidenceType === "body_evidence_timeline_followup" ? "passed" : "pending",
        evidence: secondRecord?.id ?? null,
      },
      {
        id: "previous-record-link",
        label: "Second record links back to the first durable record",
        status: followupRecord?.previousRecordId === firstRecord?.id
          && followupRecord?.previousRecordHash === firstRecord?.contentHash ? "passed" : "pending",
        evidence: firstRecord?.id ?? null,
      },
      {
        id: "no-hidden-writer",
        label: "No scheduler, background writer, command execution, or recovery was added",
        status: latestTask?.outcome?.details?.scheduler === false
          && latestTask?.outcome?.details?.backgroundWriter === false
          && latestTask?.outcome?.details?.bulkImport === false ? "passed" : "pending",
        evidence: "followup_append_readiness_governance",
      },
    ];
    const passedChecks = checklist.filter((item) => item.status === "passed").length;
    const ready = passedChecks === checklist.length;

    return {
      ok: true,
      registry: "openclaw-body-evidence-ledger-followup-record-append-readiness-v0",
      mode: "read_only_followup_append_readiness",
      generatedAt: new Date().toISOString(),
      status: ready ? "ready_for_route_review" : "waiting_for_followup_append",
      source: {
        service: "openclaw-core",
        taskId: latestTask?.id ?? null,
        taskRegistry: followupRecord?.registry ?? null,
        appendRegistry: followupRecord?.appendResult?.registry ?? null,
        ledgerFile: ledger.ledgerFileDisplayPath,
        evidence: "body_evidence_ledger_followup_record_append_readiness",
      },
      checklist,
      summary: {
        ready,
        passedChecks,
        totalChecks: checklist.length,
        taskId: latestTask?.id ?? null,
        approvalId: latestTask?.approval?.requestId ?? latestTask?.approval?.id ?? null,
        approvalStatus: latestTask?.approval?.status ?? null,
        plannedRecordType: followupRecord?.plannedRecordType ?? null,
        plannedSequence: followupRecord?.plannedSequence ?? null,
        recordId: followupRecord?.recordId ?? null,
        previousRecordId: followupRecord?.previousRecordId ?? null,
        previousRecordHash: followupRecord?.previousRecordHash ?? null,
        contentHash: followupRecord?.contentHash ?? null,
        existingRecordCount: ledger.lineCount,
        recordAppended: followupRecord?.recordAppended === true,
        durableStorageWritten: followupRecord?.durableStorageWritten === true,
        hiddenMutation: false,
      },
      evidence: {
        task: latestTask ? serialiseTask(latestTask) : null,
        followupRecord,
        ledger,
        firstRecord,
        secondRecord,
        routeBoundary: [
          "return to whitepaper route review before additional ledger records",
          "no scheduler",
          "no background writer",
          "no command execution",
          "no recovery action",
        ],
      },
      governance: {
        readsTaskHistoryOnly: true,
        createsTask: false,
        createsApproval: false,
        executesCommand: false,
        hostMutation: false,
        canAppendLedgerRecord: false,
        canWriteLedger: false,
        recordAppended: false,
        durableStorageWritten: false,
        triggersRecovery: false,
        schedulesFollowUp: false,
        backgroundWriter: false,
        bulkImport: false,
      },
      next: {
        recommendedSlice: "openclaw-phase-2-next-capability-route-review",
        boundary: "return to whitepaper route review before more ledger writes, schedulers, background persistence, or broader mutation",
      },
    };
  }

  return {
    buildBodyEvidenceLedgerFollowupRecordReadiness,
    buildBodyEvidenceLedgerFollowupRecordAppendRouteReview,
    buildBodyEvidenceLedgerFollowupRecordAppendReadiness,
    armBodyEvidenceLedgerFollowupRecordAppend,
  };
}
