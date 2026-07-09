import { randomUUID } from "node:crypto";
import path from "node:path";

export const NATIVE_ENGINEERING_LSP_LIFECYCLE_STATE_REGISTRY = "openclaw-native-engineering-lsp-lifecycle-state-v0";

const DEFAULT_STATE_LIMIT = 20;
const MAX_STATE_LIMIT = 100;
const MAX_HISTORY_ENTRIES = 12;
const OUTPUT_PREVIEW_CHARS = 512;

function normalisePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function normaliseLanguage(value) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "typescript";
}

function normaliseWorkspace(workspace = {}) {
  return {
    id: workspace?.id ?? null,
    name: workspace?.name ?? null,
    path: workspace?.path ?? null,
  };
}

function workspaceIdentity(workspace = {}) {
  return workspace?.id ?? workspace?.path ?? "default-workspace";
}

function lifecycleStateKey({ workspace = {}, language = "typescript" } = {}) {
  return `${normaliseLanguage(language)}::${workspaceIdentity(workspace)}`;
}

function boundedText(value, limit = OUTPUT_PREVIEW_CHARS) {
  if (typeof value !== "string" || !value) {
    return "";
  }
  return value.length <= limit ? value : value.slice(0, limit);
}

function summariseProcessOutput(processSupervision = {}) {
  return {
    stdout: {
      bytes: processSupervision.stdout?.bytes ?? 0,
      truncated: processSupervision.stdout?.truncated === true,
      preview: boundedText(processSupervision.stdout?.text ?? ""),
    },
    stderr: {
      bytes: processSupervision.stderr?.bytes ?? 0,
      truncated: processSupervision.stderr?.truncated === true,
      preview: boundedText(processSupervision.stderr?.text ?? ""),
    },
  };
}

function statusForExecution(execution = {}) {
  const action = execution.lifecycleAction ?? "start";
  if (action === "stop") {
    return "stopped_no_live_process";
  }
  if (execution.result?.state === "server_binary_missing") {
    return "recovery_required_server_binary_missing";
  }
  if (execution.result?.state === "process_supervision_start_failed") {
    return "recovery_required_process_start_failed";
  }
  if (execution.result?.state === "process_supervision_probe_completed_json_rpc_deferred") {
    return "probe_completed_no_live_process";
  }
  if (execution.result?.state === "initialize_shutdown_handshake_completed_source_content_deferred") {
    return "initialize_shutdown_handshake_completed";
  }
  if (execution.result?.state === "initialize_shutdown_handshake_failed") {
    return "recovery_required_initialize_shutdown_handshake_failed";
  }
  if (execution.result?.state === "didopen_source_transfer_completed_symbol_requests_deferred") {
    return "didopen_source_transfer_completed";
  }
  if (execution.result?.state === "didopen_source_transfer_failed") {
    return "recovery_required_didopen_source_transfer_failed";
  }
  return execution.result?.state ?? "recorded";
}

function eventForRecord({ task, execution }) {
  return {
    at: execution.completedAt ?? new Date().toISOString(),
    taskId: task?.id ?? null,
    approvalId: task?.approval?.requestId ?? null,
    lifecycleAction: execution.lifecycleAction ?? null,
    resultState: execution.result?.state ?? null,
    processStarted: execution.server?.processStarted === true,
    processTerminated: execution.server?.processTerminated === true,
    jsonRpcEnabled: execution.server?.jsonRpcHandshakeSent === true,
    jsonRpcHandshakeSent: execution.server?.jsonRpcHandshakeSent === true,
    didOpenSent: execution.server?.didOpenSent === true,
    sourceContentTransferred: execution.server?.sourceContentTransferred === true,
  };
}

export function recordNativeEngineeringLspLifecycleExecution({
  records,
  task,
  execution,
} = {}) {
  if (!records || typeof records.set !== "function") {
    return null;
  }
  const metadata = task?.engineeringLspLifecycle ?? {};
  const workspace = normaliseWorkspace(metadata.workspace);
  const language = normaliseLanguage(metadata.language);
  const key = lifecycleStateKey({ workspace, language });
  const previous = records.get(key) ?? null;
  const now = new Date().toISOString();
  const history = [
    ...(Array.isArray(previous?.history) ? previous.history : []),
    eventForRecord({ task, execution }),
  ].slice(-MAX_HISTORY_ENTRIES);
  const processSupervision = execution?.processSupervision ?? {};
  const record = {
    registry: NATIVE_ENGINEERING_LSP_LIFECYCLE_STATE_REGISTRY,
    id: previous?.id ?? randomUUID(),
    key,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    workspace,
    language,
    lifecycleAction: execution?.lifecycleAction ?? metadata.lifecycleAction ?? "start",
    sourceTaskId: task?.id ?? null,
    sourceApprovalId: task?.approval?.requestId ?? null,
    sourceExecutionRegistry: execution?.registry ?? null,
    status: statusForExecution(execution),
    server: {
      serverBinary: execution?.server?.serverBinary ?? metadata.server?.serverBinary ?? null,
      serverArgs: execution?.server?.serverArgs ?? metadata.server?.serverArgs ?? [],
      binaryChecked: execution?.server?.binaryChecked === true,
      binaryFound: execution?.server?.binaryFound === true,
      executablePath: execution?.server?.executablePath ?? null,
      jsonRpcHandshakeSent: execution?.server?.jsonRpcHandshakeSent === true,
      didOpenSent: execution?.server?.didOpenSent === true,
      sourceContentTransferred: execution?.server?.sourceContentTransferred === true,
    },
    process: {
      supervisionMode: processSupervision.mode ?? "not_attempted",
      probeAttempted: processSupervision.attempted === true,
      processStarted: execution?.server?.processStarted === true,
      processId: execution?.server?.processId ?? null,
      aliveAtProbe: execution?.server?.processAliveAtProbe === true,
      terminated: execution?.server?.processTerminated === true,
      exitCode: processSupervision.exitCode ?? null,
      signal: processSupervision.signal ?? null,
      longLivedProcessActive: false,
      reusableProcessState: false,
      protocolHandshake: processSupervision.protocolHandshake ?? {
        mode: "not_attempted",
        attempted: false,
      },
    },
    output: summariseProcessOutput(processSupervision),
    recoveryRecommendation: execution?.recoveryRecommendation ?? null,
    boundaries: {
      approvalRequiredBeforeExecution: true,
      canStartWithoutApproval: false,
      longLivedProcessActive: false,
      jsonRpcEnabled: execution?.server?.jsonRpcHandshakeSent === true,
      jsonRpcInitializeShutdownOnly: execution?.server?.jsonRpcHandshakeSent === true
        && execution?.server?.didOpenSent !== true,
      jsonRpcOperationalRequestsEnabled: false,
      sourceContentTransferred: execution?.server?.sourceContentTransferred === true,
      providerEgress: false,
      rootOrHostDaemonRequired: false,
    },
    history,
  };
  records.set(key, record);
  return record;
}

function serialiseRecord(record) {
  return {
    ...record,
    workspace: normaliseWorkspace(record.workspace),
    history: Array.isArray(record.history) ? record.history : [],
  };
}

function matchesWorkspace(record, workspacePath) {
  if (!workspacePath) {
    return true;
  }
  const target = path.resolve(workspacePath);
  return record.workspace?.path ? path.resolve(record.workspace.path) === target : false;
}

export function createNativeEngineeringLspLifecycleStateBuilders({
  records,
  selectOpenClawToolCatalogWorkspace,
} = {}) {
  function buildNativeEngineeringLspLifecycleState({
    workspacePath = null,
    language = null,
    limit = DEFAULT_STATE_LIMIT,
  } = {}) {
    let selectedWorkspace = null;
    if (workspacePath) {
      selectedWorkspace = selectOpenClawToolCatalogWorkspace({ workspacePath }).item;
    }
    const safeLimit = normalisePositiveInteger(limit, DEFAULT_STATE_LIMIT, MAX_STATE_LIMIT);
    const safeLanguage = language ? normaliseLanguage(language) : null;
    const items = [...(records?.values?.() ?? [])]
      .map(serialiseRecord)
      .filter((record) => !safeLanguage || record.language === safeLanguage)
      .filter((record) => matchesWorkspace(record, selectedWorkspace?.path ?? null))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, safeLimit);
    return {
      ok: true,
      registry: NATIVE_ENGINEERING_LSP_LIFECYCLE_STATE_REGISTRY,
      mode: "read-only-lsp-lifecycle-state-readback",
      generatedAt: new Date().toISOString(),
      query: {
        workspacePath: selectedWorkspace?.path ?? workspacePath ?? null,
        language: safeLanguage,
        limit: safeLimit,
      },
      summary: {
        totalRecords: items.length,
        activeLongLivedProcesses: items.filter((item) => item.process?.longLivedProcessActive === true).length,
        jsonRpcEnabled: items.some((item) => item.boundaries?.jsonRpcEnabled === true),
        jsonRpcOperationalRequestsEnabled: false,
        sourceContentTransferred: items.some((item) => item.boundaries?.sourceContentTransferred === true),
      },
      items,
      governance: {
        readOnly: true,
        createsTask: false,
        createsApproval: false,
        canStartProcess: false,
        canStopProcess: false,
        jsonRpcEnabled: false,
        contentExposed: items.some((item) => item.boundaries?.sourceContentTransferred === true),
        providerEgress: false,
      },
    };
  }

  return {
    buildNativeEngineeringLspLifecycleState,
  };
}
