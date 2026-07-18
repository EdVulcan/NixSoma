import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { hostdRestartCapabilityForTarget } from "../../../packages/shared-systemd/src/openclaw-hostd-capabilities.mjs";
import { requestHostdRestart } from "./hostd-control-client.mjs";
import { createSystemdRepairVerification } from "./systemd-repair-verification.mjs";

export function createSystemBodyTaskHandlers({
  client,
  state,
  taskManager,
  publishEvent,
  hostdControlClient = requestHostdRestart,
}) {
  const { fetchJson, postJson, systemSenseUrl } = client;
  const {
    persistState,
    SYSTEMD_REPAIR_EXECUTION_TIMEOUT_MS,
    SYSTEMD_REPAIR_POST_VERIFICATION_ATTEMPTS = 30,
    SYSTEMD_REPAIR_POST_VERIFICATION_POLL_MS = 100,
    HOSTD_SOCKET_PATH,
    SYSTEMD_REPAIR_AUTH_DELEGATION,
    SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
    SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY,
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY,
    SYSTEMD_REPAIR_REAL_EXECUTION_UNIT,
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT,
    BODY_EVIDENCE_LEDGER_DIR,
    BODY_EVIDENCE_LEDGER_FILE_PATH,
  } = state;
  const bodyEvidenceLedgerDir = BODY_EVIDENCE_LEDGER_DIR
    ?? path.resolve(process.cwd(), "../..", ".artifacts/openclaw-body-evidence-ledger");
  const bodyEvidenceLedgerFilePath = BODY_EVIDENCE_LEDGER_FILE_PATH
    ?? path.join(bodyEvidenceLedgerDir, "body-evidence-ledger.jsonl");
  const {
    serialiseTask,
    setTaskPhase,
    completeTask,
    reconcileRuntimeState,
  } = taskManager;
  const systemdRepairVerification = createSystemdRepairVerification({
    fetchJson,
    systemSenseUrl,
    postVerificationAttempts: SYSTEMD_REPAIR_POST_VERIFICATION_ATTEMPTS,
    postVerificationPollMs: SYSTEMD_REPAIR_POST_VERIFICATION_POLL_MS,
  });

  function isSystemdRepairExecutionTask(task) {
    return task?.type === "systemd_repair_execution_task"
      && task?.systemdRepair?.registry === SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY;
  }

  function isSystemdNextRepairTask(task) {
    return task?.type === "systemd_next_repair_task"
      && (task?.systemdNextRepair?.registry === SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY
        || task?.systemdNextRepair?.registry === SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY);
  }

  function isBodyEvidenceLedgerDirectoryTask(task) {
    return task?.type === "body_evidence_ledger_directory_task";
  }

  function isBodyEvidenceLedgerFirstRecordTask(task) {
    return task?.type === "body_evidence_ledger_first_record_task"
      && task?.bodyEvidenceLedgerFirstRecord?.registry === "openclaw-body-evidence-ledger-first-record-task-v0";
  }

  function isBodyEvidenceLedgerFollowupRecordTask(task) {
    return task?.type === "body_evidence_ledger_followup_record_task"
      && task?.bodyEvidenceLedgerFollowupRecord?.registry === "openclaw-body-evidence-ledger-followup-record-task-v0";
  }

  function readBodyEvidenceLedgerLines() {
    const ledgerFileDisplayPath = ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl";
    const ledgerFilePath = bodyEvidenceLedgerFilePath;
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

  async function deferSystemdRepairExecutionTask(task) {
    const deferredTask = await setTaskPhase(task, "systemd_repair_execution_deferred", {
      status: "completed",
      details: {
        executor: "systemd-repair-execution-task-v0",
        reason: "operator_reviewed_execution_task_shell_only",
        target: task.systemdRepair?.target ?? null,
        command: task.systemdRepair?.command ?? null,
        hostMutation: false,
        executed: false,
      },
    });
    deferredTask.outcome = {
      kind: "systemd_repair_execution_deferred",
      summary: `Operator-reviewed systemd repair execution task shell for ${task.systemdRepair?.target?.unit ?? "unknown unit"} is ready; no restart executed.`,
      details: {
        systemdRepair: task.systemdRepair ?? null,
        hostMutation: false,
        executed: false,
        futureExecutionRequiresSeparateMilestone: true,
      },
      at: deferredTask.updatedAt,
    };
    deferredTask.closedAt = deferredTask.updatedAt;
    reconcileRuntimeState();
    persistState();
    await publishEvent(createEventName("systemd.repair.execution_deferred"), { task: serialiseTask(deferredTask) });

    return {
      task: deferredTask,
      policy: deferredTask.policy?.decision ?? null,
      approval: deferredTask.approval ?? null,
      blocked: false,
      reason: null,
      execution: {
        mode: "deferred_execution_shell",
        target: deferredTask.systemdRepair?.target ?? null,
        command: deferredTask.systemdRepair?.command ?? null,
        hostMutation: false,
        executed: false,
      },
    };
  }

  function buildSystemdRepairCommandTranscript(task, result) {
    const repair = task.systemdRepair ?? task.systemdNextRepair ?? {};
    const command = repair.command ?? {};
    const args = Array.isArray(command.args) ? command.args : [];
    const actualArgs = Array.isArray(result.args) ? result.args : [];
    return {
      stepId: task.systemdNextRepair ? "execute-next-systemd-restart" : "execute-systemd-restart",
      actionKind: task.systemdNextRepair ? "systemd.next_repair.execute" : "systemd.repair.execute",
      capabilityId: "act.system.heal",
      invocationId: result.invocationId,
      command: [command.command ?? "systemctl", ...args].join(" "),
      actualCommand: [result.command ?? command.command ?? "systemctl", ...actualArgs].join(" "),
      authDelegation: result.authDelegation ?? null,
      transport: result.nativeMutation?.transport ?? result.authDelegation?.transport ?? null,
      method: result.nativeMutation?.method ?? result.authDelegation?.method ?? null,
      nativeCapability: result.nativeMutation?.capability ?? null,
      jobPath: result.nativeMutation?.jobPath ?? null,
      beforeMainPid: result.nativeMutation?.before?.mainPid ?? null,
      afterMainPid: result.nativeMutation?.after?.mainPid ?? null,
      peerIdentity: result.peerIdentity ?? null,
      skipped: false,
      skipReason: null,
      condition: null,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  function compactHostdPeerIdentity(hostdResponse) {
    const governance = hostdResponse?.governance;
    if (!governance || typeof governance !== "object") return null;
    return {
      boundary: governance.callerBoundary ?? null,
      verified: governance.socketPeerIdentityVerified === true,
      matched: governance.socketPeerIdentityMatched === true,
    };
  }

  async function runSystemdRepairCommand(task) {
    const repair = task.systemdRepair ?? task.systemdNextRepair ?? {};
    const command = repair.command ?? {};
    const requestedArgs = Array.isArray(command.args) ? command.args : ["restart", repair.target?.unit ?? SYSTEMD_REPAIR_REAL_EXECUTION_UNIT];
    const targetCapability = hostdRestartCapabilityForTarget(repair.target?.unit ?? null);
    const useHostd = Boolean(
      HOSTD_SOCKET_PATH
      && targetCapability
      && command.command === "systemctl"
      && requestedArgs[0] === "restart"
      && requestedArgs[1] === targetCapability.targetUnit
    );
    const args = [];
    const authDelegation = useHostd
      ? {
          mode: SYSTEMD_REPAIR_AUTH_DELEGATION ?? "polkit-dbus-fixed-unit",
          helper: null,
          socketPath: HOSTD_SOCKET_PATH,
          sudo: null,
          transport: "unix_socket",
          method: "org.freedesktop.systemd1.Manager.RestartUnit",
          passwordPromptAllowed: false,
          scope: `restart ${targetCapability?.targetUnit ?? "allowlisted OpenClaw unit"} only`,
        }
      : {
          mode: "hostd-control-required",
          helper: null,
          socketPath: null,
          sudo: null,
          transport: null,
          method: null,
          passwordPromptAllowed: false,
          scope: "no command fallback",
        };
    const startedAt = new Date().toISOString();

    if (!useHostd) {
      return {
        invocationId: randomUUID(),
        command: "not-executed",
        args: [],
        requestedCommand: command.command ?? "systemctl",
        requestedArgs,
        authDelegation,
        startedAt,
        completedAt: new Date().toISOString(),
        exitCode: 126,
        timedOut: false,
        stdout: "",
        stderr: "OpenClaw hostd fixed-unit control is not configured for this target.",
        ok: false,
      };
    }

    try {
      const hostdResponse = await hostdControlClient({
        socketPath: HOSTD_SOCKET_PATH,
        timeoutMs: SYSTEMD_REPAIR_EXECUTION_TIMEOUT_MS,
        targetUnit: targetCapability.targetUnit,
        operation: targetCapability.operation,
      });
      const nativeMutation = hostdResponse?.nativeMutation;
      const peerIdentity = compactHostdPeerIdentity(hostdResponse);
      if (hostdResponse?.ok !== true
        || hostdResponse.owner !== "openclaw-hostd"
        || hostdResponse.transport !== "unix_socket"
        || nativeMutation?.ok !== true
        || nativeMutation.owner !== "openclaw-hostd"
        || nativeMutation.transport !== "dbus_native"
        || nativeMutation.method !== "org.freedesktop.systemd1.Manager.RestartUnit"
        || nativeMutation.unit !== targetCapability.targetUnit
        || nativeMutation.capability?.capabilityId !== targetCapability.capabilityId
        || !String(nativeMutation.jobPath).startsWith("/org/freedesktop/systemd1/job/")
        || !Number.isInteger(nativeMutation.before?.mainPid)
        || !Number.isInteger(nativeMutation.after?.mainPid)
        || nativeMutation.before.mainPid === nativeMutation.after.mainPid
        || nativeMutation.after.activeState !== "active"
        || nativeMutation.after.subState !== "running"
        || hostdResponse.governance?.callerBoundary !== "kernel_so_peercred"
        || hostdResponse.governance?.socketPeerIdentityVerified !== true
        || hostdResponse.governance?.socketPeerIdentityMatched !== true) {
        const error = new Error("OpenClaw hostd returned invalid native mutation evidence.");
        error.peerIdentity = peerIdentity;
        throw error;
      }
      return {
        invocationId: randomUUID(),
        command: "openclaw-hostd",
        args,
        requestedCommand: command.command ?? "systemctl",
        requestedArgs,
        authDelegation,
        startedAt,
        completedAt: new Date().toISOString(),
        exitCode: 0,
        timedOut: false,
        stdout: JSON.stringify(hostdResponse),
        stderr: "",
        nativeMutation,
        hostdResponse,
        peerIdentity,
        ok: true,
      };
    } catch (error) {
      const exitCode = Number.isInteger(error?.code) ? error.code : 1;
      return {
        invocationId: randomUUID(),
        command: "openclaw-hostd",
        args,
        requestedCommand: command.command ?? "systemctl",
        requestedArgs,
        authDelegation,
        startedAt,
        completedAt: new Date().toISOString(),
        exitCode,
        timedOut: error?.killed === true || error?.signal === "SIGTERM",
        stdout: typeof error?.stdout === "string" ? error.stdout : "",
        stderr: typeof error?.stderr === "string" && error.stderr.trim()
          ? error.stderr
          : error instanceof Error
            ? error.message
            : "Native systemd restart failed.",
        peerIdentity: error?.peerIdentity ?? null,
        ok: false,
      };
    }
  }

  async function executeBodyEvidenceLedgerDirectoryTask(task) {
    const directory = task.bodyEvidenceLedgerDirectory ?? {};
    const displayPath = typeof directory.displayPath === "string" && directory.displayPath.trim()
      ? directory.displayPath.trim()
      : ".artifacts/openclaw-body-evidence-ledger";
    const executionPath = bodyEvidenceLedgerDir;

    await setTaskPhase(task, "body_evidence_ledger_directory_create", {
      status: "running",
      details: {
        executor: "body-evidence-ledger-directory-task-v0",
        target: displayPath,
        executionPath,
        hostMutation: true,
        recordWritesEnabled: false,
      },
    });

    const result = await postJson(`${systemSenseUrl}/system/files/mkdir`, {
      path: executionPath,
      recursive: true,
      intent: "body.evidence.ledger.directory.create",
    });
    task.bodyEvidenceLedgerDirectory = {
      ...directory,
      resolvedPath: result.path ?? null,
      allowedRoot: result.root ?? null,
      directoryCreated: result.created === true,
      directoryExists: true,
      durableStorageWritten: false,
      recordWritesEnabled: false,
      mkdirResult: {
        registry: "openclaw-body-evidence-ledger-directory-execution-v0",
        mode: result.mode ?? "mkdir",
        created: result.created === true,
        recursive: result.recursive === true,
        metadata: result.metadata ?? null,
      },
    };
    const completedTask = completeTask(task, {
      executor: "body-evidence-ledger-directory-task-v0",
      summary: `Created OpenClaw body evidence ledger directory at ${displayPath}; no ledger records written.`,
      target: displayPath,
      result,
      hostMutation: true,
      directoryCreated: result.created === true,
      directoryExists: true,
      durableStorageWritten: false,
      recordWritesEnabled: false,
    });
    await publishEvent(createEventName("body_evidence_ledger.directory_created"), {
      task: serialiseTask(completedTask),
      target: displayPath,
      path: result.path ?? null,
      created: result.created === true,
    });

    return {
      task: completedTask,
      policy: completedTask.policy?.decision ?? null,
      approval: completedTask.approval ?? null,
      actions: [],
      verification: null,
      execution: {
        registry: "openclaw-body-evidence-ledger-directory-execution-v0",
        mode: "approved_directory_creation",
        target: displayPath,
        path: result.path ?? null,
        hostMutation: true,
        directoryCreated: result.created === true,
        directoryExists: true,
        durableStorageWritten: false,
        recordWritesEnabled: false,
      },
    };
  }

  async function executeBodyEvidenceLedgerFirstRecordTask(task) {
    const firstRecord = task.bodyEvidenceLedgerFirstRecord ?? {};
    const recordType = typeof firstRecord.plannedRecordType === "string" && firstRecord.plannedRecordType.trim()
      ? firstRecord.plannedRecordType.trim()
      : "body_evidence_ledger_bootstrap";
    const ledgerFileDisplayPath = ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl";
    const ledgerFilePath = bodyEvidenceLedgerFilePath;
    const timelineReadiness = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-timeline-readiness`);
    const recordedAt = new Date().toISOString();
    const recordBase = {
      id: `body-ledger-${randomUUID()}`,
      recordedAt,
      sourceRegistry: firstRecord.sourceRegistry ?? "openclaw-body-evidence-timeline-readiness-v0",
      sourceEndpoint: "/system/route/body-evidence-timeline-readiness",
      phase: "phase_2_body_evidence_memory",
      evidenceType: recordType,
      summary: "Bootstrap durable OpenClaw body evidence memory from timeline readiness evidence.",
      evidence: {
        timelineReadinessRegistry: timelineReadiness.registry ?? null,
        timelineReady: timelineReadiness.summary?.ready === true || timelineReadiness.ready === true,
        bodyMemoryPurpose: timelineReadiness.memoryPurpose ?? timelineReadiness.purpose ?? "operator-visible body evidence memory",
        sourceChecks: timelineReadiness.summary?.checks ?? timelineReadiness.checks ?? null,
      },
      governance: {
        taskId: task.id,
        approvalId: task.approval?.requestId ?? null,
        approved: isTaskPolicyApproved(task),
        appendOnly: true,
        scheduler: false,
        backgroundWriter: false,
        bulkImport: false,
        hostMutation: true,
        scope: ledgerFileDisplayPath,
      },
    };
    const contentHash = createHash("sha256").update(JSON.stringify(recordBase)).digest("hex");
    const record = {
      ...recordBase,
      contentHash,
    };
    const line = `${JSON.stringify(record)}\n`;

    await setTaskPhase(task, "body_evidence_ledger_first_record_append", {
      status: "running",
      details: {
        executor: "body-evidence-ledger-first-record-task-v0",
        ledgerFile: ledgerFileDisplayPath,
        recordType,
        hostMutation: true,
        durableStorageWritten: false,
      },
    });

    const result = await postJson(`${systemSenseUrl}/system/files/append-text`, {
      path: ledgerFilePath,
      content: line,
      encoding: "utf8",
      createIfMissing: true,
      intent: "body.evidence.ledger.record.append",
    });
    task.bodyEvidenceLedgerFirstRecord = {
      ...firstRecord,
      ledgerFileDisplayPath,
      ledgerFilePath: result.path ?? ledgerFilePath,
      allowedRoot: result.root ?? null,
      recordId: record.id,
      contentHash,
      contentBytes: result.contentBytes ?? Buffer.byteLength(line, "utf8"),
      previousBytes: result.previousBytes ?? 0,
      totalBytes: result.totalBytes ?? null,
      recordAppended: true,
      durableStorageWritten: true,
      appendExecutionEnabled: true,
      appendResult: {
        registry: "openclaw-body-evidence-ledger-first-record-append-v0",
        mode: result.mode ?? "append_text",
        created: result.created === true,
        createIfMissing: result.createIfMissing === true,
        metadata: result.metadata ?? null,
      },
    };
    const completedTask = completeTask(task, {
      executor: "body-evidence-ledger-first-record-task-v0",
      summary: `Appended first OpenClaw body evidence ledger record ${record.id} to ${ledgerFileDisplayPath}.`,
      ledgerFile: ledgerFileDisplayPath,
      result,
      record,
      hostMutation: true,
      recordAppended: true,
      durableStorageWritten: true,
      scheduler: false,
      backgroundWriter: false,
      bulkImport: false,
    });
    await publishEvent(createEventName("body_evidence_ledger.first_record_appended"), {
      task: serialiseTask(completedTask),
      ledgerFile: ledgerFileDisplayPath,
      recordId: record.id,
      contentHash,
    });

    return {
      task: completedTask,
      policy: completedTask.policy?.decision ?? null,
      approval: completedTask.approval ?? null,
      actions: [],
      verification: null,
      execution: {
        registry: "openclaw-body-evidence-ledger-first-record-append-v0",
        mode: "approved_first_record_append",
        ledgerFile: ledgerFileDisplayPath,
        path: result.path ?? null,
        recordId: record.id,
        contentHash,
        hostMutation: true,
        recordAppended: true,
        durableStorageWritten: true,
        scheduler: false,
        backgroundWriter: false,
        bulkImport: false,
      },
    };
  }

  async function deferBodyEvidenceLedgerFollowupRecordTask(task) {
    const followupRecord = task.bodyEvidenceLedgerFollowupRecord ?? {};
    const recordType = typeof followupRecord.plannedRecordType === "string" && followupRecord.plannedRecordType.trim()
      ? followupRecord.plannedRecordType.trim()
      : "body_evidence_timeline_followup";
    const plannedSequence = Number.isInteger(followupRecord.plannedSequence) ? followupRecord.plannedSequence : 2;
    const deferredTask = await setTaskPhase(task, "body_evidence_ledger_followup_record_deferred", {
      status: "completed",
      details: {
        executor: "body-evidence-ledger-followup-record-task-v0",
        reason: "followup_record_task_shell_only",
        recordType,
        plannedSequence,
        hostMutation: false,
        recordAppended: false,
        durableStorageWritten: false,
        scheduler: false,
        backgroundWriter: false,
      },
    });
    deferredTask.bodyEvidenceLedgerFollowupRecord = {
      ...followupRecord,
      recordAppended: false,
      durableStorageWritten: false,
      appendExecutionEnabled: false,
      deferredExecution: {
        registry: "openclaw-body-evidence-ledger-followup-record-task-v0",
        mode: "deferred_followup_record_append_shell",
        recordType,
        plannedSequence,
        hostMutation: false,
        recordAppended: false,
        durableStorageWritten: false,
        scheduler: false,
        backgroundWriter: false,
        futureAppendRequiresSeparateMilestone: true,
      },
    };
    deferredTask.outcome = {
      kind: "body_evidence_ledger_followup_record_deferred",
      summary: `Follow-up ledger record ${plannedSequence} task shell is ready; no JSONL append executed.`,
      details: {
        bodyEvidenceLedgerFollowupRecord: deferredTask.bodyEvidenceLedgerFollowupRecord,
        hostMutation: false,
        recordAppended: false,
        durableStorageWritten: false,
        futureAppendRequiresSeparateMilestone: true,
      },
    };
    persistState();
    await publishEvent(createEventName("body_evidence_ledger.followup_record_deferred"), {
      task: serialiseTask(deferredTask),
      recordType,
      plannedSequence,
    });

    return {
      task: deferredTask,
      policy: deferredTask.policy?.decision ?? null,
      approval: deferredTask.approval ?? null,
      actions: [],
      verification: null,
      execution: {
        registry: "openclaw-body-evidence-ledger-followup-record-task-v0",
        mode: "deferred_followup_record_append_shell",
        recordType,
        plannedSequence,
        hostMutation: false,
        recordAppended: false,
        durableStorageWritten: false,
        scheduler: false,
        backgroundWriter: false,
        futureAppendRequiresSeparateMilestone: true,
      },
    };
  }

  async function executeBodyEvidenceLedgerFollowupRecordTask(task) {
    const followupRecord = task.bodyEvidenceLedgerFollowupRecord ?? {};
    const recordType = typeof followupRecord.plannedRecordType === "string" && followupRecord.plannedRecordType.trim()
      ? followupRecord.plannedRecordType.trim()
      : "body_evidence_timeline_followup";
    const plannedSequence = Number.isInteger(followupRecord.plannedSequence) ? followupRecord.plannedSequence : 2;
    const ledgerFileDisplayPath = ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl";
    const ledgerFilePath = bodyEvidenceLedgerFilePath;
    const ledger = readBodyEvidenceLedgerLines();
    if (!ledger.exists || ledger.lineCount !== 1 || ledger.records?.[0]?.ok !== true) {
      throw new Error("Follow-up ledger append requires exactly one existing valid ledger record.");
    }

    if (followupRecord.appendRouteReviewRegistry !== "openclaw-body-evidence-ledger-followup-record-append-route-review-v0") {
      throw new Error("Follow-up ledger append requires a stored append route review.");
    }

    const timelineReadiness = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-timeline-readiness`);
    const previousRecord = ledger.records[0];
    const recordedAt = new Date().toISOString();
    const recordBase = {
      id: `body-ledger-${randomUUID()}`,
      recordedAt,
      sourceRegistry: followupRecord.sourceRegistry ?? "openclaw-body-evidence-timeline-readiness-v0",
      sourceEndpoint: followupRecord.sourceEndpoint ?? "/system/route/body-evidence-timeline-readiness",
      phase: "phase_2_body_evidence_memory",
      evidenceType: recordType,
      sequence: plannedSequence,
      summary: "Follow-up durable OpenClaw body evidence memory from the latest timeline readiness evidence.",
      previousRecord: {
        id: previousRecord.id ?? null,
        evidenceType: previousRecord.evidenceType ?? null,
        sourceRegistry: previousRecord.sourceRegistry ?? null,
        contentHash: previousRecord.contentHash ?? null,
      },
      evidence: {
        timelineReadinessRegistry: timelineReadiness.registry ?? null,
        timelineReady: timelineReadiness.summary?.ready === true || timelineReadiness.ready === true,
        bodyMemoryPurpose: timelineReadiness.memoryPurpose ?? timelineReadiness.purpose ?? "operator-visible body evidence memory",
        sourceChecks: timelineReadiness.summary?.checks ?? timelineReadiness.checks ?? null,
        routeReviewRegistry: followupRecord.appendRouteReviewRegistry,
      },
      governance: {
        taskId: task.id,
        approvalId: task.approval?.requestId ?? null,
        approved: isTaskPolicyApproved(task),
        appendOnly: true,
        scheduler: false,
        backgroundWriter: false,
        bulkImport: false,
        hostMutation: true,
        scope: ledgerFileDisplayPath,
      },
    };
    const contentHash = createHash("sha256").update(JSON.stringify(recordBase)).digest("hex");
    const record = {
      ...recordBase,
      contentHash,
    };
    const line = `${JSON.stringify(record)}\n`;

    await setTaskPhase(task, "body_evidence_ledger_followup_record_append", {
      status: "running",
      details: {
        executor: "body-evidence-ledger-followup-record-append-v0",
        ledgerFile: ledgerFileDisplayPath,
        recordType,
        plannedSequence,
        hostMutation: true,
        durableStorageWritten: false,
      },
    });

    const result = await postJson(`${systemSenseUrl}/system/files/append-text`, {
      path: ledgerFilePath,
      content: line,
      encoding: "utf8",
      createIfMissing: false,
      intent: "body.evidence.ledger.followup_record.append",
    });
    task.bodyEvidenceLedgerFollowupRecord = {
      ...followupRecord,
      ledgerFileDisplayPath,
      ledgerFilePath: result.path ?? ledgerFilePath,
      allowedRoot: result.root ?? null,
      recordId: record.id,
      contentHash,
      previousRecordId: previousRecord.id ?? null,
      previousRecordHash: previousRecord.contentHash ?? null,
      contentBytes: result.contentBytes ?? Buffer.byteLength(line, "utf8"),
      previousBytes: result.previousBytes ?? null,
      totalBytes: result.totalBytes ?? null,
      recordAppended: true,
      durableStorageWritten: true,
      appendExecutionEnabled: true,
      appendResult: {
        registry: "openclaw-body-evidence-ledger-followup-record-append-v0",
        mode: result.mode ?? "append_text",
        created: result.created === true,
        createIfMissing: result.createIfMissing === true,
        metadata: result.metadata ?? null,
      },
    };
    const completedTask = completeTask(task, {
      executor: "body-evidence-ledger-followup-record-append-v0",
      summary: `Appended follow-up OpenClaw body evidence ledger record ${record.id} to ${ledgerFileDisplayPath}.`,
      ledgerFile: ledgerFileDisplayPath,
      result,
      record,
      previousRecord: record.previousRecord,
      hostMutation: true,
      recordAppended: true,
      durableStorageWritten: true,
      scheduler: false,
      backgroundWriter: false,
      bulkImport: false,
    });
    await publishEvent(createEventName("body_evidence_ledger.followup_record_appended"), {
      task: serialiseTask(completedTask),
      ledgerFile: ledgerFileDisplayPath,
      recordId: record.id,
      previousRecordId: record.previousRecord.id,
      contentHash,
    });

    return {
      task: completedTask,
      policy: completedTask.policy?.decision ?? null,
      approval: completedTask.approval ?? null,
      actions: [],
      verification: null,
      execution: {
        registry: "openclaw-body-evidence-ledger-followup-record-append-v0",
        mode: "approved_followup_record_append",
        ledgerFile: ledgerFileDisplayPath,
        path: result.path ?? null,
        recordId: record.id,
        previousRecordId: record.previousRecord.id,
        contentHash,
        hostMutation: true,
        recordAppended: true,
        durableStorageWritten: true,
        scheduler: false,
        backgroundWriter: false,
        bulkImport: false,
      },
    };
  }

  async function executeSystemdRepairExecutionTask(task) {
    const targetUnit = task.systemdRepair?.target?.unit ?? null;
    if (targetUnit !== SYSTEMD_REPAIR_REAL_EXECUTION_UNIT) {
      throw new Error(`Real systemd repair execution is limited to ${SYSTEMD_REPAIR_REAL_EXECUTION_UNIT}.`);
    }

    const command = task.systemdRepair?.command ?? {};
    const args = Array.isArray(command.args) ? command.args : [];
    if (command.command !== "systemctl" || args[0] !== "restart" || args[1] !== SYSTEMD_REPAIR_REAL_EXECUTION_UNIT) {
      throw new Error(`Unexpected systemd repair command: ${JSON.stringify(command)}`);
    }

    const beforeVerification = await systemdRepairVerification.captureSnapshot(targetUnit, "before_real_execution");
    const runningTask = await setTaskPhase(task, "systemd_repair_execution_running", {
      status: "running",
      details: {
        executor: "systemd-repair-execution-task-v0",
        target: task.systemdRepair?.target ?? null,
        command,
        hostMutationAttempted: true,
        executed: true,
      },
    });
    const result = await runSystemdRepairCommand(runningTask);
    const commandTranscript = [buildSystemdRepairCommandTranscript(runningTask, result)];
    const afterVerification = await systemdRepairVerification.capturePostRestartSnapshot(targetUnit, "after_real_execution");
    const postExecutionVerification = systemdRepairVerification.buildPostExecutionVerification(
      targetUnit,
      beforeVerification,
      afterVerification,
      result,
    );
    const rollbackNote =
      runningTask.systemdRepair?.evidence?.plan?.proposal?.rollbackNote
      ?? runningTask.systemdRepair?.evidence?.dryRunEnvelope?.plan?.proposal?.rollbackNote
      ?? null;
    const status = result.ok ? "completed" : "failed";
    const phase = result.ok ? "systemd_repair_execution_completed" : "systemd_repair_execution_failed";
    const updatedTask = await setTaskPhase(runningTask, phase, {
      status,
      details: {
        executor: "systemd-repair-execution-task-v0",
        target: runningTask.systemdRepair?.target ?? null,
        command,
        hostMutation: true,
        hostMutationAttempted: true,
        executed: true,
        commandTranscript,
        result,
        postExecutionVerification,
      },
    });
    updatedTask.systemdRepair = {
      ...(updatedTask.systemdRepair ?? {}),
      execution: {
        ...(updatedTask.systemdRepair?.execution ?? {}),
        shellOnly: false,
        realExecutionEnabled: true,
        hostMutation: true,
        hostMutationAttempted: true,
        executed: true,
        executionSucceeded: result.ok,
        exitCode: result.exitCode,
        completedAt: result.completedAt,
        authDelegation: result.authDelegation ?? null,
      },
    };
    updatedTask.outcome = {
      kind: result.ok ? "systemd_repair_execution_completed" : "systemd_repair_execution_failed",
      summary: result.ok
        ? `Operator-approved systemd restart completed for ${targetUnit}.`
        : `Operator-approved systemd restart attempted for ${targetUnit} and exited with code ${result.exitCode}.`,
      reason: result.ok ? null : "systemd_restart_nonzero_exit",
      details: {
        systemdRepair: updatedTask.systemdRepair,
        target: updatedTask.systemdRepair?.target ?? null,
        command,
        hostMutation: true,
        hostMutationAttempted: true,
        executed: true,
        executionSucceeded: result.ok,
        authDelegation: result.authDelegation ?? null,
        commandTranscript,
        result,
        postExecutionVerification,
        rollbackNote,
      },
      at: updatedTask.updatedAt,
    };
    updatedTask.closedAt = updatedTask.updatedAt;
    reconcileRuntimeState();
    persistState();
    await publishEvent(result.ok ? "systemd.repair.execution_completed" : "systemd.repair.execution_failed", {
      task: serialiseTask(updatedTask),
      result,
    });

    return {
      task: updatedTask,
      policy: updatedTask.policy?.decision ?? null,
      approval: updatedTask.approval ?? null,
      blocked: false,
      reason: null,
      commandTranscript,
      verification: { ok: result.ok, checks: [], failedChecks: result.ok ? [] : [{ name: "native_dbus_restart_exit_code", expected: 0, actual: result.exitCode }] },
      execution: {
        mode: "operator_reviewed_real_systemd_restart",
        target: updatedTask.systemdRepair?.target ?? null,
        command,
        hostMutation: true,
        hostMutationAttempted: true,
        executed: true,
        executionSucceeded: result.ok,
        exitCode: result.exitCode,
        authDelegation: result.authDelegation ?? null,
        postExecutionVerification,
        rollbackNote: updatedTask.outcome.details.rollbackNote,
      },
    };
  }

  async function deferSystemdNextRepairTask(task) {
    const deferredTask = await setTaskPhase(task, "systemd_next_repair_execution_deferred", {
      status: "completed",
      details: {
        executor: "systemd-next-repair-task-shell-v0",
        reason: "next_repair_task_shell_only",
        target: task.systemdNextRepair?.target ?? null,
        command: task.systemdNextRepair?.command ?? null,
        hostMutation: false,
        executed: false,
      },
    });
    deferredTask.outcome = {
      kind: "systemd_next_repair_execution_deferred",
      summary: `Next OpenClaw systemd repair task shell for ${task.systemdNextRepair?.target?.unit ?? "unknown unit"} is ready; no restart executed.`,
      details: {
        systemdNextRepair: task.systemdNextRepair ?? null,
        hostMutation: false,
        executed: false,
        futureExecutionRequiresSeparateMilestone: true,
      },
      at: deferredTask.updatedAt,
    };
    deferredTask.closedAt = deferredTask.updatedAt;
    reconcileRuntimeState();
    persistState();
    await publishEvent(createEventName("systemd.next_repair.execution_deferred"), { task: serialiseTask(deferredTask) });

    return {
      task: deferredTask,
      policy: deferredTask.policy?.decision ?? null,
      approval: deferredTask.approval ?? null,
      blocked: false,
      reason: null,
      execution: {
        mode: "next_repair_deferred_execution_shell",
        target: deferredTask.systemdNextRepair?.target ?? null,
        command: deferredTask.systemdNextRepair?.command ?? null,
        hostMutation: false,
        executed: false,
      },
    };
  }

  async function executeSystemdNextRepairTask(task) {
    const targetUnit = task.systemdNextRepair?.target?.unit ?? null;
    const targetCapability = hostdRestartCapabilityForTarget(targetUnit);
    if (!targetCapability) {
      throw new Error(`Next real systemd repair execution is not supported by hostd for ${targetUnit}.`);
    }

    const command = task.systemdNextRepair?.command ?? {};
    const args = Array.isArray(command.args) ? command.args : [];
    if (command.command !== "systemctl" || args[0] !== "restart" || args[1] !== targetCapability.targetUnit) {
      throw new Error(`Unexpected next systemd repair command: ${JSON.stringify(command)}`);
    }

    const beforeVerification = await systemdRepairVerification.captureSnapshot(targetUnit, "before_next_real_execution");
    const incidentDiagnosis = await systemdRepairVerification.captureIncidentDiagnosis({
      taskId: task.id,
      stepId: "execute-next-systemd-restart",
      targetUnit,
      before: beforeVerification,
    });
    const runningTask = await setTaskPhase(task, "systemd_next_repair_execution_running", {
      status: "running",
      details: {
        executor: "systemd-next-repair-real-execution-v0",
        target: task.systemdNextRepair?.target ?? null,
        command,
        incidentDiagnosis,
        hostMutationAttempted: true,
        executed: true,
      },
    });
    const result = await runSystemdRepairCommand(runningTask);
    const commandTranscript = [buildSystemdRepairCommandTranscript(runningTask, result)];
    const afterVerification = await systemdRepairVerification.capturePostRestartSnapshot(targetUnit, "after_next_real_execution");
    const postExecutionVerification = systemdRepairVerification.buildPostExecutionVerification(
      targetUnit,
      beforeVerification,
      afterVerification,
      result,
    );
    const incidentReceipt = systemdRepairVerification.buildIncidentReceipt({
      task: runningTask,
      stepId: "execute-next-systemd-restart",
      diagnosis: incidentDiagnosis,
      verification: postExecutionVerification,
      result,
    });
    const rollbackNote = "If this restart degrades body health, inspect systemd status and verify health before attempting any further repair.";
    const repairSucceeded = postExecutionVerification.summary.restoredHealthy === true;
    const status = repairSucceeded ? "completed" : "failed";
    const phase = repairSucceeded ? "systemd_next_repair_execution_completed" : "systemd_next_repair_execution_failed";
    const updatedTask = await setTaskPhase(runningTask, phase, {
      status,
      details: {
        executor: "systemd-next-repair-real-execution-v0",
        target: runningTask.systemdNextRepair?.target ?? null,
        command,
        hostMutation: true,
        hostMutationAttempted: true,
        executed: true,
        commandTranscript,
        result,
        incidentDiagnosis,
        incidentReceipt,
        postExecutionVerification,
      },
    });
    updatedTask.systemdNextRepair = {
      ...(updatedTask.systemdNextRepair ?? {}),
      execution: {
        ...(updatedTask.systemdNextRepair?.execution ?? {}),
        shellOnly: false,
        realExecutionEnabled: true,
        hostMutation: true,
        hostMutationAttempted: true,
        executed: true,
        executionSucceeded: result.ok,
        repairSucceeded,
        exitCode: result.exitCode,
        completedAt: result.completedAt,
        authDelegation: result.authDelegation ?? null,
      },
    };
    updatedTask.outcome = {
      kind: repairSucceeded ? "systemd_next_repair_execution_completed" : "systemd_next_repair_execution_failed",
      summary: repairSucceeded
        ? `Operator-approved next systemd restart completed for ${targetUnit}.`
        : result.ok
          ? `Operator-approved next systemd restart completed for ${targetUnit}, but target health was not restored.`
          : `Operator-approved next systemd restart attempted for ${targetUnit} and exited with code ${result.exitCode}.`,
      reason: repairSucceeded ? null : result.ok ? "systemd_next_repair_health_not_restored" : "systemd_next_restart_nonzero_exit",
      details: {
        systemdNextRepair: updatedTask.systemdNextRepair,
        target: updatedTask.systemdNextRepair?.target ?? null,
        command,
        hostMutation: true,
        hostMutationAttempted: true,
        executed: true,
        executionSucceeded: result.ok,
        repairSucceeded,
        authDelegation: result.authDelegation ?? null,
        commandTranscript,
        result,
        incidentDiagnosis,
        incidentReceipt,
        postExecutionVerification,
        rollbackNote,
      },
      at: updatedTask.updatedAt,
    };
    updatedTask.closedAt = updatedTask.updatedAt;
    reconcileRuntimeState();
    persistState();
    await publishEvent(repairSucceeded ? "systemd.next_repair.execution_completed" : "systemd.next_repair.execution_failed", {
      task: serialiseTask(updatedTask),
      result,
    });

    return {
      task: updatedTask,
      policy: updatedTask.policy?.decision ?? null,
      approval: updatedTask.approval ?? null,
      blocked: false,
      reason: null,
      commandTranscript,
      verification: {
        ok: repairSucceeded,
        checks: [],
        failedChecks: repairSucceeded
          ? []
          : [{
              name: result.ok ? "systemd_next_repair_restored_health" : "systemctl_next_restart_exit_code",
              expected: result.ok ? true : 0,
              actual: result.ok ? false : result.exitCode,
            }],
      },
      execution: {
        mode: "operator_reviewed_next_real_systemd_restart",
        target: updatedTask.systemdNextRepair?.target ?? null,
        command,
        hostMutation: true,
        hostMutationAttempted: true,
        executed: true,
        executionSucceeded: result.ok,
        repairSucceeded,
        exitCode: result.exitCode,
        authDelegation: result.authDelegation ?? null,
        incidentDiagnosis,
        incidentReceipt,
        postExecutionVerification,
        rollbackNote: updatedTask.outcome.details.rollbackNote,
      },
    };
  }

  return [
    {
      name: "systemd-repair-execution",
      predicate: isSystemdRepairExecutionTask,
      execute: (task) => task.systemdRepair?.execution?.realExecutionEnabled === true
        ? executeSystemdRepairExecutionTask(task)
        : deferSystemdRepairExecutionTask(task),
    },
    {
      name: "systemd-next-repair",
      predicate: isSystemdNextRepairTask,
      execute: (task) => task.systemdNextRepair?.execution?.realExecutionEnabled === true
        ? executeSystemdNextRepairTask(task)
        : deferSystemdNextRepairTask(task),
    },
    { name: "body-evidence-ledger-directory", predicate: isBodyEvidenceLedgerDirectoryTask, execute: executeBodyEvidenceLedgerDirectoryTask },
    { name: "body-evidence-ledger-first-record", predicate: isBodyEvidenceLedgerFirstRecordTask, execute: executeBodyEvidenceLedgerFirstRecordTask },
    {
      name: "body-evidence-ledger-followup-record",
      predicate: isBodyEvidenceLedgerFollowupRecordTask,
      execute: (task) => task.bodyEvidenceLedgerFollowupRecord?.appendExecutionEnabled === true
        ? executeBodyEvidenceLedgerFollowupRecordTask(task)
        : deferBodyEvidenceLedgerFollowupRecordTask(task),
    },
  ];
}
