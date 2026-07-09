import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { accessSync, constants, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { recordNativeEngineeringLspLifecycleExecution } from "./native-engineering-lsp-lifecycle-state.mjs";
import {
  createLspInitializeDidOpenShutdownHandshake,
  createLspInitializeShutdownHandshake,
  createLspSymbolRequestHandshake,
  shouldRunLspInitializeShutdownHandshake,
  shouldRunLspSymbolRequestHandshake,
  shouldRunLspSourceTransferHandshake,
} from "./native-engineering-lsp-protocol-handshake.mjs";
import { buildNativeEngineeringLspSourceTransferProposalForWorkspace } from "./native-engineering-lsp-source-transfer-proposal-builders.mjs";

export const NATIVE_ENGINEERING_LSP_LIFECYCLE_TASK_REGISTRY = "openclaw-native-engineering-lsp-lifecycle-task-v0";
export const NATIVE_ENGINEERING_LSP_LIFECYCLE_EXECUTION_REGISTRY = "openclaw-native-engineering-lsp-lifecycle-execution-v0";

const DEFAULT_PROCESS_PROBE_MS = 300;
const MAX_PROCESS_PROBE_MS = 2_000;
const DEFAULT_PROCESS_OUTPUT_CHARS = 4_096;
const SOURCE_TRANSFER_ACTION = "source_transfer";
const SYMBOL_REQUEST_ACTION = "symbol_request";
const PROCESS_SUPERVISION_ACTIONS = new Set(["start", "restart", "recover", "handshake", SOURCE_TRANSFER_ACTION, SYMBOL_REQUEST_ACTION]);
const BINARY_GATE_ACTIONS = new Set(["start", "restart", "recover", "handshake", SOURCE_TRANSFER_ACTION, SYMBOL_REQUEST_ACTION]);

function redactedWorkspace(workspace) {
  return {
    id: workspace?.id ?? null,
    name: workspace?.name ?? null,
    path: workspace?.path ?? null,
  };
}

function buildPolicyDecision({ now, goal, autonomyMode }) {
  return {
    id: randomUUID(),
    at: now,
    engine: "openclaw-native-engineering-lsp-lifecycle-task-v0",
    stage: "openclaw.native.engineering_lsp_lifecycle.task",
    subject: {
      taskId: null,
      type: "native_engineering_lsp_lifecycle",
      goal,
      targetUrl: null,
      intent: "openclaw.engineering.lsp.lifecycle",
    },
    domain: "body_internal",
    risk: "medium",
    decision: "require_approval",
    reason: "engineering_lsp_lifecycle_requires_explicit_user_approval",
    approved: false,
    autonomyMode,
    autonomous: false,
  };
}

function buildPolicyRequest() {
  return {
    intent: "openclaw.engineering.lsp.lifecycle",
    domain: "body_internal",
    risk: "medium",
    requiresApproval: true,
    tags: ["native_engineering", "lsp_lifecycle", "explicit_approval_required"],
  };
}

function buildLifecyclePlan({ buildRulePlan, goal, policyRequest, draft }) {
  const lifecycle = draft.lifecycleDraft;
  const action = {
    kind: "engineering.lsp.lifecycle",
    intent: "openclaw.engineering.lsp.lifecycle",
    params: {
      language: draft.query.language,
      lifecycleAction: draft.query.lifecycleAction,
      workspaceId: draft.workspace.id,
      workspacePath: draft.workspace.path,
      serverBinary: lifecycle.server.serverBinary,
      serverArgs: lifecycle.server.serverArgs,
      sourceDraftRegistry: draft.registry,
      sourceDraftId: lifecycle.id,
      jsonRpcEnabled: false,
    },
  };
  return buildRulePlan({
    goal,
    type: "native_engineering_lsp_lifecycle",
    intent: "openclaw.engineering.lsp.lifecycle",
    policy: policyRequest,
    targetUrl: null,
    actions: [action],
  });
}

function buildSourceTransferPlan({ buildRulePlan, goal, policyRequest, proposal }) {
  const action = {
    kind: "engineering.lsp.source_transfer",
    intent: "openclaw.engineering.lsp.source_transfer",
    params: {
      language: proposal.summary.language,
      lifecycleAction: SOURCE_TRANSFER_ACTION,
      workspaceId: proposal.workspace.id,
      workspacePath: proposal.workspace.path,
      relativePath: proposal.file.relativePath,
      fileUri: proposal.file.uri,
      languageId: proposal.file.languageId,
      textBytes: proposal.file.textBytes,
      textSha256: proposal.file.textSha256,
      serverBinary: proposal.serverContract.serverBinary,
      serverArgs: proposal.serverContract.serverArgs,
      sourceProposalRegistry: proposal.registry,
      jsonRpcEnabledAfterApproval: true,
      symbolRequestsEnabled: false,
    },
  };
  return buildRulePlan({
    goal,
    type: "native_engineering_lsp_lifecycle",
    intent: "openclaw.engineering.lsp.source_transfer",
    policy: policyRequest,
    targetUrl: null,
    actions: [action],
  });
}

function buildSymbolRequestPlan({ buildRulePlan, goal, policyRequest, proposal }) {
  const action = {
    kind: "engineering.lsp.symbol_request",
    intent: "openclaw.engineering.lsp.symbol_request",
    params: {
      language: proposal.query.language,
      lifecycleAction: SYMBOL_REQUEST_ACTION,
      workspaceId: proposal.workspace.id,
      workspacePath: proposal.workspace.path,
      relativePath: proposal.query.relativePath,
      symbolAction: proposal.query.action,
      method: proposal.proposedJsonRpc.method,
      line: proposal.query.line,
      character: proposal.query.character,
      sourceTaskId: proposal.prerequisite.sourceTaskId,
      sourceApprovalId: proposal.prerequisite.sourceApprovalId,
      sourceProposalRegistry: proposal.registry,
      jsonRpcEnabledAfterApproval: true,
      longLivedProcessPool: false,
    },
  };
  return buildRulePlan({
    goal,
    type: "native_engineering_lsp_lifecycle",
    intent: "openclaw.engineering.lsp.symbol_request",
    policy: policyRequest,
    targetUrl: null,
    actions: [action],
  });
}

function buildTaskMetadata(draft) {
  const lifecycle = draft.lifecycleDraft;
  return {
    registry: NATIVE_ENGINEERING_LSP_LIFECYCLE_TASK_REGISTRY,
    sourceRegistry: draft.registry,
    sourceCapabilityId: draft.capability.id,
    draftId: lifecycle.id,
    language: draft.query.language,
    lifecycleAction: draft.query.lifecycleAction,
    workspace: redactedWorkspace(draft.workspace),
    server: {
      serverBinary: lifecycle.server.serverBinary,
      serverArgs: lifecycle.server.serverArgs,
      binaryChecked: false,
      processStarted: false,
      jsonRpcHandshakeSent: false,
    },
    execution: null,
    approvedMutation: false,
    contentExposed: false,
  };
}

function buildSourceTransferTaskMetadata(proposal) {
  return {
    registry: NATIVE_ENGINEERING_LSP_LIFECYCLE_TASK_REGISTRY,
    sourceRegistry: proposal.registry,
    sourceCapabilityId: proposal.capability.id,
    draftId: `openclaw-lsp-source-transfer-${proposal.summary.language}-${proposal.file.relativePath}`,
    language: proposal.summary.language,
    lifecycleAction: SOURCE_TRANSFER_ACTION,
    workspace: redactedWorkspace(proposal.workspace),
    server: {
      serverBinary: proposal.serverContract.serverBinary,
      serverArgs: proposal.serverContract.serverArgs,
      binaryChecked: false,
      processStarted: false,
      jsonRpcHandshakeSent: false,
      didOpenSent: false,
      sourceContentTransferred: false,
    },
    sourceTransfer: {
      registry: proposal.registry,
      capabilityId: proposal.capability.id,
      relativePath: proposal.file.relativePath,
      uri: proposal.file.uri,
      languageId: proposal.file.languageId,
      textBytes: proposal.file.textBytes,
      lineCount: proposal.file.lineCount,
      textSha256: proposal.file.textSha256,
      maxFileSizeBytes: proposal.bounds.maxFileSizeBytes,
      maxPreviewChars: proposal.bounds.maxPreviewChars,
      proposalPreviewTruncated: proposal.sourcePreview.truncated,
      didOpenSent: false,
      sourceContentTransferred: false,
      symbolRequestsSent: false,
    },
    execution: null,
    approvedMutation: false,
    contentExposed: false,
  };
}

function buildSymbolRequestTaskMetadata(proposal) {
  const sourceTransfer = proposal.prerequisite.sourceTransfer ?? {};
  return {
    registry: NATIVE_ENGINEERING_LSP_LIFECYCLE_TASK_REGISTRY,
    sourceRegistry: proposal.registry,
    sourceCapabilityId: proposal.capability.id,
    draftId: `openclaw-lsp-symbol-${proposal.query.action}-${proposal.query.relativePath}`,
    language: proposal.query.language,
    lifecycleAction: SYMBOL_REQUEST_ACTION,
    workspace: redactedWorkspace(proposal.workspace),
    server: {
      serverBinary: proposal.prerequisite.server?.serverBinary ?? "typescript-language-server",
      serverArgs: proposal.prerequisite.server?.serverArgs ?? ["--stdio"],
      binaryChecked: false,
      processStarted: false,
      jsonRpcHandshakeSent: false,
      didOpenSent: false,
      sourceContentTransferred: false,
      symbolRequestSent: false,
    },
    sourceTransfer: {
      registry: "openclaw-native-engineering-lsp-source-transfer-proposal-v0",
      relativePath: sourceTransfer.relativePath ?? proposal.query.relativePath,
      uri: sourceTransfer.uri ?? proposal.proposedJsonRpc.params?.textDocument?.uri ?? null,
      languageId: sourceTransfer.languageId ?? proposal.query.language,
      textBytes: sourceTransfer.textBytes ?? null,
      textSha256: sourceTransfer.textSha256 ?? null,
      maxFileSizeBytes: 128 * 1024,
      maxPreviewChars: 8_000,
      didOpenSent: false,
      sourceContentTransferred: false,
      symbolRequestsSent: false,
    },
    symbolRequest: {
      registry: proposal.registry,
      capabilityId: proposal.capability.id,
      action: proposal.query.action,
      method: proposal.proposedJsonRpc.method,
      params: proposal.proposedJsonRpc.params,
      line: proposal.query.line,
      character: proposal.query.character,
      sourceTaskId: proposal.prerequisite.sourceTaskId,
      sourceApprovalId: proposal.prerequisite.sourceApprovalId,
      sent: false,
    },
    execution: null,
    approvedMutation: false,
    contentExposed: false,
  };
}

export function createNativeEngineeringLspLifecycleTaskBuilders({
  autonomyMode,
  buildNativeEngineeringLspLifecycleDraft,
  buildNativeEngineeringLspSourceTransferProposal,
  buildNativeEngineeringLspSymbolRequestProposal,
  buildRulePlan,
  createTask,
  createApprovalRequestForTask,
  persistState,
  publishEvent,
  publishTaskApprovalIfPending,
  reconcileRuntimeState,
  serialisePlanForPublic,
  serialiseTask,
  supersedeOtherActiveTasks,
}) {
  async function createNativeEngineeringLspLifecycleTask({
    workspacePath = null,
    language = "typescript",
    lifecycleAction = "start",
    relativePath = "src/app.ts",
    symbolAction = "definition",
    line = 1,
    character = 0,
    maxFileSizeBytes = null,
    maxPreviewChars = null,
    confirm = false,
  } = {}) {
    if (confirm !== true) {
      throw new Error("Native engineering LSP lifecycle task creation requires confirm=true.");
    }

    const safeLifecycleAction = lifecycleAction === SOURCE_TRANSFER_ACTION
      ? SOURCE_TRANSFER_ACTION
      : lifecycleAction === SYMBOL_REQUEST_ACTION
        ? SYMBOL_REQUEST_ACTION
        : lifecycleAction;
    const sourceTransferProposal = safeLifecycleAction === SOURCE_TRANSFER_ACTION
      ? buildNativeEngineeringLspSourceTransferProposal({
          workspacePath,
          language,
          relativePath,
          maxFileSizeBytes,
          maxPreviewChars,
        })
      : null;
    const symbolRequestProposal = safeLifecycleAction === SYMBOL_REQUEST_ACTION
      ? buildNativeEngineeringLspSymbolRequestProposal({
          workspacePath,
          language,
          action: symbolAction,
          relativePath,
          line,
          character,
        })
      : null;
    if (symbolRequestProposal && symbolRequestProposal.prerequisite?.found !== true) {
      throw new Error("LSP symbol request task requires approved didOpen source-transfer state.");
    }
    const draft = sourceTransferProposal
      ? null
      : symbolRequestProposal
        ? null
      : buildNativeEngineeringLspLifecycleDraft({
          workspacePath,
          language,
          lifecycleAction: safeLifecycleAction,
        });
    const now = new Date().toISOString();
    const goal = sourceTransferProposal
      ? `Run approved OpenClaw LSP source transfer for ${sourceTransferProposal.file.relativePath}`
      : symbolRequestProposal
      ? `Run approved OpenClaw LSP ${symbolRequestProposal.query.action} request for ${symbolRequestProposal.query.relativePath}`
      : `Run approved OpenClaw LSP lifecycle ${draft.query.lifecycleAction} gate for ${draft.query.language}`;
    const policyRequest = buildPolicyRequest();
    const policyDecision = buildPolicyDecision({ now, goal, autonomyMode });
    const plan = sourceTransferProposal
      ? buildSourceTransferPlan({ buildRulePlan, goal, policyRequest, proposal: sourceTransferProposal })
      : symbolRequestProposal
      ? buildSymbolRequestPlan({ buildRulePlan, goal, policyRequest, proposal: symbolRequestProposal })
      : buildLifecyclePlan({ buildRulePlan, goal, policyRequest, draft });

    const task = createTask({
      goal,
      type: "native_engineering_lsp_lifecycle",
      workViewStrategy: "openclaw-native-engineering-lsp-lifecycle",
      plan,
      policy: policyRequest,
    }, { skipInitialPolicy: true });
    task.policy = {
      request: policyRequest,
      decision: policyDecision,
    };
    task.engineeringLspLifecycle = sourceTransferProposal
      ? buildSourceTransferTaskMetadata(sourceTransferProposal)
      : symbolRequestProposal
      ? buildSymbolRequestTaskMetadata(symbolRequestProposal)
      : buildTaskMetadata(draft);
    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent("task.created", { task: serialiseTask(task), planner: NATIVE_ENGINEERING_LSP_LIFECYCLE_TASK_REGISTRY });
    await publishTaskApprovalIfPending(task);
    await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
      task: serialiseTask(reclaimedTask),
    })));

    return {
      registry: NATIVE_ENGINEERING_LSP_LIFECYCLE_TASK_REGISTRY,
      mode: sourceTransferProposal
        ? "approval-gated-lsp-source-transfer-didopen"
        : symbolRequestProposal
        ? "approval-gated-lsp-symbol-request"
        : "approval-gated-lsp-lifecycle-binary-gate",
      generatedAt: new Date().toISOString(),
      sourceRegistry: sourceTransferProposal?.registry ?? symbolRequestProposal?.registry ?? draft.registry,
      lifecycleDraft: draft
        ? {
            registry: draft.registry,
            mode: draft.mode,
            id: draft.lifecycleDraft.id,
            readinessGates: draft.readinessGates,
          }
        : null,
      sourceTransferProposal: sourceTransferProposal
        ? {
            registry: sourceTransferProposal.registry,
            mode: sourceTransferProposal.mode,
            file: sourceTransferProposal.file,
            proposedDidOpen: sourceTransferProposal.proposedDidOpen,
            sourcePreview: sourceTransferProposal.sourcePreview,
            auditEvidence: sourceTransferProposal.auditEvidence,
          }
        : null,
      symbolRequestProposal: symbolRequestProposal
        ? {
            registry: symbolRequestProposal.registry,
            mode: symbolRequestProposal.mode,
            prerequisite: symbolRequestProposal.prerequisite,
            proposedJsonRpc: symbolRequestProposal.proposedJsonRpc,
            auditEvidence: symbolRequestProposal.auditEvidence,
          }
        : null,
      engineeringLspLifecycle: task.engineeringLspLifecycle,
      task,
      approval,
      governance: {
        createsTask: true,
        createsApproval: true,
        canExecuteWithoutApproval: false,
        canStartProcessWithoutApproval: false,
        canSendJsonRpcRequest: sourceTransferProposal
          ? "after_approval_didopen_only"
          : symbolRequestProposal
            ? "after_approval_symbol_request_only"
            : false,
        contentExposed: false,
        sourceTransferRequiresApproval: Boolean(sourceTransferProposal),
        symbolRequestRequiresApproval: Boolean(symbolRequestProposal),
      },
    };
  }

  return {
    createNativeEngineeringLspLifecycleTask,
  };
}

function isApproved(task, approvals) {
  const approval = task?.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  return task?.policy?.decision?.approved === true
    || task?.policy?.request?.approved === true
    || approval?.status === "approved";
}

function resolveExecutablePath(binary, envPath = process.env.PATH ?? "") {
  if (typeof binary !== "string" || !binary.trim()) {
    return null;
  }
  const candidate = binary.trim();
  const paths = candidate.includes(path.sep)
    ? [candidate]
    : envPath.split(path.delimiter).filter(Boolean).map((entry) => path.join(entry, candidate));
  for (const item of paths) {
    try {
      accessSync(item, constants.X_OK);
      return item;
    } catch {
      // Keep scanning PATH entries.
    }
  }
  return null;
}

function normalisePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function safeRealpath(value) {
  try {
    return realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

function safeStat(value) {
  try {
    return statSync(value);
  } catch {
    return null;
  }
}

function isInsidePath(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveSupervisionCwd(metadata, workspaceRoots = []) {
  const workspacePath = typeof metadata.workspace?.path === "string" && metadata.workspace.path.trim()
    ? metadata.workspace.path.trim()
    : null;
  if (!workspacePath) {
    throw new Error("Native engineering LSP lifecycle task is missing a workspace path.");
  }
  const cwd = safeRealpath(workspacePath);
  const roots = Array.isArray(workspaceRoots) && workspaceRoots.length > 0
    ? workspaceRoots.map((root) => safeRealpath(root))
    : [cwd];
  if (!roots.some((root) => isInsidePath(root, cwd))) {
    throw new Error("Native engineering LSP lifecycle workspace path is outside configured workspace roots.");
  }
  return { cwd, allowedRoots: roots };
}

function loadApprovedSourceTransferContent(metadata, workspaceRoots = []) {
  const sourceTransfer = metadata.sourceTransfer ?? null;
  if (!sourceTransfer) {
    return null;
  }
  const cwd = resolveSupervisionCwd(metadata, workspaceRoots).cwd;
  const workspace = {
    registry: { registry: "openclaw-approved-lsp-source-transfer-workspace-v0" },
    item: {
      id: metadata.workspace?.id ?? "approved-lsp-source-transfer-workspace",
      name: metadata.workspace?.name ?? "Approved LSP Source Transfer Workspace",
      path: cwd,
    },
    rootPath: cwd,
    rootRealPath: cwd,
  };
  const proposal = buildNativeEngineeringLspSourceTransferProposalForWorkspace({
    workspace,
    safeStat,
    language: metadata.language ?? sourceTransfer.languageId ?? "typescript",
    relativePath: sourceTransfer.relativePath,
    maxFileSizeBytes: sourceTransfer.maxFileSizeBytes,
    maxPreviewChars: sourceTransfer.maxPreviewChars,
    includeSourceTextForExecution: true,
  });
  if (proposal.file.textSha256 !== sourceTransfer.textSha256) {
    throw new Error("Approved LSP source-transfer proposal hash no longer matches workspace file content.");
  }
  return {
    proposal,
    sourceContent: proposal.executionSourceContent,
    transfer: {
      relativePath: proposal.file.relativePath,
      uri: proposal.file.uri,
      languageId: proposal.file.languageId,
      textBytes: proposal.file.textBytes,
      lineCount: proposal.file.lineCount,
      textSha256: proposal.file.textSha256,
    },
  };
}

function appendBoundedOutput(current, chunk, limit) {
  const text = current.text + chunk.toString("utf8");
  if (text.length <= limit) {
    return {
      text,
      truncated: current.truncated,
      bytes: current.bytes + Buffer.byteLength(chunk),
    };
  }
  return {
    text: text.slice(0, limit),
    truncated: true,
    bytes: current.bytes + Buffer.byteLength(chunk),
  };
}

function shouldRunProcessSupervisionProbe(metadata) {
  return PROCESS_SUPERVISION_ACTIONS.has(metadata.lifecycleAction ?? "start");
}

function shouldCheckBinaryGate(metadata) {
  return BINARY_GATE_ACTIONS.has(metadata.lifecycleAction ?? "start");
}

function startSupervisedLifecycleProcess({
  executablePath,
  args = [],
  cwd,
  probeMs = DEFAULT_PROCESS_PROBE_MS,
  outputLimit = DEFAULT_PROCESS_OUTPUT_CHARS,
  protocolHandshake = null,
} = {}) {
  return new Promise((resolve) => {
    const safeProbeMs = normalisePositiveInteger(probeMs, DEFAULT_PROCESS_PROBE_MS, MAX_PROCESS_PROBE_MS);
    const startedAt = new Date().toISOString();
    const stdoutInitial = { text: "", truncated: false, bytes: 0 };
    const stderrInitial = { text: "", truncated: false, bytes: 0 };
    let stdout = stdoutInitial;
    let stderr = stderrInitial;
    let settled = false;
    let terminationSent = false;
    let killSent = false;
    let processAliveAtProbe = false;
    let protocolHandshakeEvidence = protocolHandshake
      ? { mode: "initialize_shutdown_handshake_only", attempted: false, ok: false }
      : { mode: "not_attempted", attempted: false };
    let probeTimer = null;
    let killTimer = null;
    let child = null;

    function finish(result) {
      if (settled) {
        return;
      }
      settled = true;
      if (probeTimer) {
        clearTimeout(probeTimer);
      }
      if (killTimer) {
        clearTimeout(killTimer);
      }
      resolve({
        mode: "supervised_user_space_process_probe",
        attempted: true,
        executablePath,
        args,
        cwd,
        probeMs: safeProbeMs,
        outputLimitChars: outputLimit,
        protocolHandshake: protocolHandshake
          ? protocolHandshake.summarise({ stdoutText: stdout.text, stderrText: stderr.text })
          : protocolHandshakeEvidence,
        startedAt,
        completedAt: new Date().toISOString(),
        terminationSent,
        killSent,
        stdout,
        stderr,
        ...result,
      });
    }

    try {
      child = spawn(executablePath, args, {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      finish({
        started: false,
        pid: null,
        processAliveAtProbe: false,
        processTerminated: false,
        exitCode: null,
        signal: null,
        error: error instanceof Error ? error.message : "Unable to start LSP server process.",
      });
      return;
    }

    child.stdout?.on("data", (chunk) => {
      stdout = appendBoundedOutput(stdout, chunk, outputLimit);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendBoundedOutput(stderr, chunk, outputLimit);
    });
    child.on("error", (error) => {
      finish({
        started: false,
        pid: child?.pid ?? null,
        processAliveAtProbe: false,
        processTerminated: false,
        exitCode: null,
        signal: null,
        error: error instanceof Error ? error.message : "Unable to start LSP server process.",
      });
    });
    child.on("exit", (code, signal) => {
      finish({
        started: Boolean(child?.pid),
        pid: child?.pid ?? null,
        processAliveAtProbe,
        processTerminated: terminationSent || killSent,
        exitCode: Number.isInteger(code) ? code : null,
        signal: signal ?? null,
        error: null,
      });
    });
    child.on("spawn", () => {
      if (protocolHandshake) {
        protocolHandshakeEvidence = protocolHandshake.write(child.stdin);
        probeTimer = setTimeout(() => {
          if (!settled) {
            processAliveAtProbe = true;
            terminationSent = true;
            child.kill("SIGTERM");
          }
        }, safeProbeMs);
        return;
      }
      probeTimer = setTimeout(() => {
        if (settled) {
          return;
        }
        processAliveAtProbe = true;
        terminationSent = true;
        child.kill("SIGTERM");
        killTimer = setTimeout(() => {
          if (!settled) {
            killSent = true;
            child.kill("SIGKILL");
          }
        }, 250);
      }, safeProbeMs);
    });
  });
}

function resultStateForExecution({ lifecycleAction = "start", binaryChecked, binaryFound, processProbe }) {
  if (lifecycleAction === "stop") {
    return {
      ok: true,
      state: "stop_recorded_no_live_process",
      failureKind: null,
    };
  }
  if (binaryChecked && !binaryFound) {
    return {
      ok: false,
      state: "server_binary_missing",
      failureKind: "lsp_server_binary_missing",
    };
  }
  if (lifecycleAction === "handshake") {
    if (processProbe?.protocolHandshake?.ok === true) {
      return {
        ok: true,
        state: "initialize_shutdown_handshake_completed_source_content_deferred",
        failureKind: null,
      };
    }
    return {
      ok: false,
      state: "initialize_shutdown_handshake_failed",
      failureKind: "lsp_initialize_shutdown_handshake_failed",
    };
  }
  if (lifecycleAction === SOURCE_TRANSFER_ACTION) {
    if (processProbe?.protocolHandshake?.ok === true && processProbe?.protocolHandshake?.didOpenSent === true) {
      return {
        ok: true,
        state: "didopen_source_transfer_completed_symbol_requests_deferred",
        failureKind: null,
      };
    }
    return {
      ok: false,
      state: "didopen_source_transfer_failed",
      failureKind: "lsp_didopen_source_transfer_failed",
    };
  }
  if (lifecycleAction === SYMBOL_REQUEST_ACTION) {
    if (processProbe?.protocolHandshake?.ok === true && processProbe?.protocolHandshake?.symbolRequestsSent === true) {
      return {
        ok: true,
        state: "symbol_request_completed_long_lived_pool_deferred",
        failureKind: null,
      };
    }
    return {
      ok: false,
      state: "symbol_request_failed",
      failureKind: "lsp_symbol_request_failed",
    };
  }
  if (!processProbe?.attempted) {
    return {
      ok: true,
      state: "binary_gate_passed_process_supervision_deferred",
      failureKind: null,
    };
  }
  if (processProbe.started === true) {
    return {
      ok: true,
      state: "process_supervision_probe_completed_json_rpc_deferred",
      failureKind: null,
    };
  }
  return {
    ok: false,
    state: "process_supervision_start_failed",
    failureKind: "lsp_server_process_start_failed",
  };
}

function buildLifecycleExecution({ task, executablePath, binaryChecked = true, approved = false, processProbe = null }) {
  const metadata = task.engineeringLspLifecycle ?? {};
  const now = new Date().toISOString();
  const serverBinary = metadata.server?.serverBinary ?? null;
  const lifecycleAction = metadata.lifecycleAction ?? "start";
  const binaryFound = binaryChecked && Boolean(executablePath);
  const result = resultStateForExecution({ lifecycleAction, binaryChecked, binaryFound, processProbe });
  return {
    registry: NATIVE_ENGINEERING_LSP_LIFECYCLE_EXECUTION_REGISTRY,
    mode: "approved-lsp-lifecycle-binary-gate",
    generatedAt: now,
    taskId: task.id,
    lifecycleAction,
    language: metadata.language ?? null,
    workspace: metadata.workspace ?? null,
    server: {
      serverBinary,
      serverArgs: metadata.server?.serverArgs ?? [],
      binaryChecked,
      binaryFound,
      executablePath: executablePath ?? null,
      processStarted: processProbe?.started === true,
      processId: processProbe?.pid ?? null,
      processAliveAtProbe: processProbe?.processAliveAtProbe === true,
      processTerminated: processProbe?.processTerminated === true,
      jsonRpcHandshakeSent: processProbe?.protocolHandshake?.attempted === true,
      didOpenSent: processProbe?.protocolHandshake?.didOpenSent === true,
      sourceContentTransferred: processProbe?.protocolHandshake?.sourceContentTransferred === true,
      symbolRequestSent: processProbe?.protocolHandshake?.symbolRequestsSent === true,
      symbolRequestMethod: processProbe?.protocolHandshake?.symbolRequestMethod ?? null,
    },
    processSupervision: processProbe ?? {
      mode: "not_attempted",
      attempted: false,
      reason: lifecycleAction === "stop"
        ? "stop_recorded_no_live_process"
        : binaryFound
          ? "process_supervision_deferred"
          : "server_binary_missing",
    },
    result,
    governance: {
      approved,
      canStartProcessWithoutApproval: false,
      processStarted: processProbe?.started === true,
      jsonRpcEnabled: processProbe?.protocolHandshake?.attempted === true,
      jsonRpcOperationalRequestsEnabled: processProbe?.protocolHandshake?.symbolRequestsSent === true,
      contentExposed: processProbe?.protocolHandshake?.sourceContentTransferred === true,
    },
    recoveryRecommendation: lifecycleAction === "stop"
      ? {
          recoverable: false,
          nextAction: "stop was recorded against the lifecycle state store; no long-lived LSP process is active in this Level 1 lane",
        }
      : result.failureKind === "lsp_initialize_shutdown_handshake_failed"
      ? {
          recoverable: true,
          nextAction: `inspect ${serverBinary ?? "the requested language server"} initialize/shutdown output and rerun the approved handshake task after fixing the server wrapper`,
        }
      : result.failureKind === "lsp_didopen_source_transfer_failed"
      ? {
          recoverable: true,
          nextAction: `inspect ${serverBinary ?? "the requested language server"} didOpen output and rerun the approved source-transfer task after fixing the server wrapper or source file`,
        }
      : result.failureKind === "lsp_symbol_request_failed"
      ? {
          recoverable: true,
          nextAction: `inspect ${serverBinary ?? "the requested language server"} symbol request output and rerun the approved symbol request task after fixing the server wrapper or source position`,
        }
      : result.failureKind === "lsp_server_process_start_failed"
      ? {
          recoverable: true,
          nextAction: `inspect ${serverBinary ?? "the requested language server"} process startup output and rerun the approved lifecycle task after fixing the service PATH or binary wrapper`,
        }
      : binaryFound
      ? {
          recoverable: true,
          nextAction: processProbe?.attempted
            ? "process supervision probe is recorded; implement persistent start/stop state before JSON-RPC"
            : "implement supervised user-space process start/stop/readback before JSON-RPC",
        }
      : {
          recoverable: true,
          nextAction: `install or expose ${serverBinary ?? "the requested language server"} in the OpenClaw service PATH, then rerun the approved lifecycle task`,
        },
  };
}

export function isNativeEngineeringLspLifecycleTask(task) {
  return task?.type === "native_engineering_lsp_lifecycle"
    || task?.engineeringLspLifecycle?.registry === NATIVE_ENGINEERING_LSP_LIFECYCLE_TASK_REGISTRY;
}

export function createNativeEngineeringLspLifecycleTaskHandlers({
  state,
  taskManager,
  approvalEngine,
  policyEvaluator,
  publishEvent,
}) {
  const { approvals, persistState, workspaceRoots, nativeEngineeringLspLifecycleRecords } = state;
  const { serialiseTask, isActiveTask, setTaskPhase, completeTask, failTask } = taskManager;
  const { serialiseApproval } = approvalEngine;
  const { ensureTaskPolicy } = policyEvaluator;

  async function executeNativeEngineeringLspLifecycleTask(task) {
    if (!isActiveTask(task)) {
      throw new Error("Native engineering LSP lifecycle task is not active.");
    }
    const policy = ensureTaskPolicy(task, { stage: "native_engineering.lsp_lifecycle.execute" });
    await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (!isApproved(task, approvals)) {
      const waitingTask = await setTaskPhase(task, "waiting_for_approval", {
        status: "queued",
        details: {
          executor: "native-engineering-lsp-lifecycle-v0",
          reason: "policy_requires_approval",
          approvalId: approval?.id ?? task.approval?.requestId ?? null,
          lifecycleAction: task.engineeringLspLifecycle?.lifecycleAction ?? null,
          language: task.engineeringLspLifecycle?.language ?? null,
        },
      });
      await publishEvent(createEventName("task.blocked"), {
        task: serialiseTask(waitingTask),
        reason: "policy_requires_approval",
        executor: "native-engineering-lsp-lifecycle-v0",
      });
      return {
        task: waitingTask,
        blocked: true,
        reason: "policy_requires_approval",
        actions: [],
        capabilityInvocations: [],
        commandTranscript: [],
        verification: null,
        policy: policy.decision,
        approval: approval ? serialiseApproval(approval) : null,
        governance: {
          mode: "native_engineering_lsp_lifecycle_waiting_for_approval",
          executed: false,
          processStarted: false,
          jsonRpcSent: false,
        },
      };
    }

    await setTaskPhase(task, "lsp_lifecycle_binary_gate", {
      status: "running",
      details: {
        executor: "native-engineering-lsp-lifecycle-v0",
        lifecycleAction: task.engineeringLspLifecycle?.lifecycleAction ?? null,
        language: task.engineeringLspLifecycle?.language ?? null,
        serverBinary: task.engineeringLspLifecycle?.server?.serverBinary ?? null,
      },
    });
    const binaryChecked = shouldCheckBinaryGate(task.engineeringLspLifecycle ?? {});
    const executablePath = binaryChecked
      ? resolveExecutablePath(task.engineeringLspLifecycle?.server?.serverBinary)
      : null;
    const sourceTransferContent = executablePath && shouldRunLspSourceTransferHandshake(task.engineeringLspLifecycle ?? {})
      ? loadApprovedSourceTransferContent(task.engineeringLspLifecycle ?? {}, workspaceRoots)
      : null;
    const symbolRequestContent = executablePath && shouldRunLspSymbolRequestHandshake(task.engineeringLspLifecycle ?? {})
      ? loadApprovedSourceTransferContent(task.engineeringLspLifecycle ?? {}, workspaceRoots)
      : null;
    const protocolHandshake = shouldRunLspSymbolRequestHandshake(task.engineeringLspLifecycle ?? {})
      ? createLspSymbolRequestHandshake({
          workspacePath: task.engineeringLspLifecycle?.workspace?.path ?? null,
          sourceTransfer: symbolRequestContent?.transfer ?? task.engineeringLspLifecycle?.sourceTransfer ?? {},
          sourceContent: symbolRequestContent?.sourceContent ?? {},
          symbolRequest: task.engineeringLspLifecycle?.symbolRequest ?? {},
        })
      : shouldRunLspSourceTransferHandshake(task.engineeringLspLifecycle ?? {})
      ? createLspInitializeDidOpenShutdownHandshake({
          workspacePath: task.engineeringLspLifecycle?.workspace?.path ?? null,
          sourceTransfer: sourceTransferContent?.transfer ?? task.engineeringLspLifecycle?.sourceTransfer ?? {},
          sourceContent: sourceTransferContent?.sourceContent ?? {},
        })
      : shouldRunLspInitializeShutdownHandshake(task.engineeringLspLifecycle ?? {})
        ? createLspInitializeShutdownHandshake({
            workspacePath: task.engineeringLspLifecycle?.workspace?.path ?? null,
          })
        : null;
    const processProbe = executablePath && shouldRunProcessSupervisionProbe(task.engineeringLspLifecycle ?? {})
      ? await startSupervisedLifecycleProcess({
          executablePath,
          args: task.engineeringLspLifecycle?.server?.serverArgs ?? [],
          cwd: resolveSupervisionCwd(task.engineeringLspLifecycle ?? {}, workspaceRoots).cwd,
          probeMs: protocolHandshake ? 1_000 : DEFAULT_PROCESS_PROBE_MS,
          protocolHandshake,
        })
      : null;
    const execution = buildLifecycleExecution({ task, executablePath, binaryChecked, approved: true, processProbe });
    const lifecycleState = recordNativeEngineeringLspLifecycleExecution({
      records: nativeEngineeringLspLifecycleRecords,
      task,
      execution,
    });
    if (lifecycleState) {
      execution.lifecycleState = lifecycleState;
    }
    task.engineeringLspLifecycle = {
      ...(task.engineeringLspLifecycle ?? {}),
      server: {
        ...(task.engineeringLspLifecycle?.server ?? {}),
        binaryChecked: execution.server.binaryChecked,
        binaryFound: execution.server.binaryFound,
        executablePath: execution.server.executablePath,
        processStarted: execution.server.processStarted,
        processId: execution.server.processId,
        processAliveAtProbe: execution.server.processAliveAtProbe,
        processTerminated: execution.server.processTerminated,
        jsonRpcHandshakeSent: execution.server.jsonRpcHandshakeSent,
        didOpenSent: execution.server.didOpenSent,
        sourceContentTransferred: execution.server.sourceContentTransferred,
        symbolRequestSent: execution.server.symbolRequestSent,
        symbolRequestMethod: execution.server.symbolRequestMethod,
      },
      sourceTransfer: task.engineeringLspLifecycle?.sourceTransfer
        ? {
            ...(task.engineeringLspLifecycle.sourceTransfer ?? {}),
            didOpenSent: execution.server.didOpenSent,
            sourceContentTransferred: execution.server.sourceContentTransferred,
            symbolRequestsSent: execution.processSupervision?.protocolHandshake?.symbolRequestsSent === true,
          }
        : task.engineeringLspLifecycle?.sourceTransfer ?? null,
      symbolRequest: task.engineeringLspLifecycle?.symbolRequest
        ? {
            ...(task.engineeringLspLifecycle.symbolRequest ?? {}),
            sent: execution.server.symbolRequestSent,
            method: execution.server.symbolRequestMethod ?? task.engineeringLspLifecycle.symbolRequest.method,
          }
        : task.engineeringLspLifecycle?.symbolRequest ?? null,
      execution,
      lifecycleState,
    };
    persistState();

    if (!execution.result.ok) {
      const failedTask = failTask(task, `LSP lifecycle ${execution.lifecycleAction ?? "start"} blocked: ${execution.result.failureKind ?? "process supervision failed"}.`, {
        executor: "native-engineering-lsp-lifecycle-v0",
        lspLifecycleExecution: execution,
        recoveryEvidence: {
          kind: "lsp_lifecycle_recovery",
          recoverable: true,
          reason: execution.result.failureKind,
          recommendation: execution.recoveryRecommendation,
        },
      });
      await publishEvent(createEventName("task.failed"), {
        task: serialiseTask(failedTask),
        reason: execution.result.failureKind,
        executor: "native-engineering-lsp-lifecycle-v0",
      });
      return {
        task: failedTask,
        blocked: true,
        reason: execution.result.failureKind,
        actions: [],
        capabilityInvocations: [],
        commandTranscript: [],
        verification: {
          ok: false,
          checks: [
            { name: "server_binary_present", ok: execution.server.binaryFound === true },
            { name: "process_supervision_probe", ok: execution.processSupervision?.started === true },
            { name: "initialize_shutdown_handshake", ok: execution.lifecycleAction === "handshake" ? execution.processSupervision?.protocolHandshake?.ok === true : null },
            { name: "didopen_source_transfer", ok: execution.lifecycleAction === SOURCE_TRANSFER_ACTION ? execution.processSupervision?.protocolHandshake?.didOpenSent === true : null },
            { name: "symbol_request", ok: execution.lifecycleAction === SYMBOL_REQUEST_ACTION ? execution.processSupervision?.protocolHandshake?.symbolRequestsSent === true : null },
            { name: "lifecycle_state_recorded", ok: Boolean(lifecycleState) },
          ],
          failedChecks: execution.result.failureKind === "lsp_initialize_shutdown_handshake_failed"
            ? ["initialize_shutdown_handshake"]
            : execution.result.failureKind === "lsp_didopen_source_transfer_failed"
            ? ["didopen_source_transfer"]
            : execution.result.failureKind === "lsp_symbol_request_failed"
            ? ["symbol_request"]
            : execution.server.binaryFound ? ["process_supervision_probe"] : ["server_binary_present"],
        },
        policy: policy.decision,
        approval: approval ? serialiseApproval(approval) : null,
        execution,
      };
    }

    const completedTask = completeTask(task, {
      executor: "native-engineering-lsp-lifecycle-v0",
      summary: execution.lifecycleAction === "stop"
        ? "LSP lifecycle stop state recorded; no long-lived process is active."
        : execution.lifecycleAction === "handshake"
        ? "LSP lifecycle initialize/shutdown handshake completed; source-content transfer remains deferred."
        : execution.lifecycleAction === SOURCE_TRANSFER_ACTION
        ? "LSP didOpen source-transfer completed after approval; symbol requests remain deferred."
        : execution.lifecycleAction === SYMBOL_REQUEST_ACTION
        ? "LSP symbol request completed after approval; long-lived process pools remain deferred."
        : execution.processSupervision?.attempted
        ? "LSP lifecycle process supervision probe completed; JSON-RPC remains deferred."
        : "LSP lifecycle binary gate passed; process supervision remains deferred.",
      lspLifecycleExecution: execution,
    });
    await publishEvent(createEventName("task.completed"), {
      task: serialiseTask(completedTask),
      executor: "native-engineering-lsp-lifecycle-v0",
    });
    return {
      task: completedTask,
      blocked: false,
      actions: [],
      capabilityInvocations: [],
      commandTranscript: [],
      verification: {
        ok: true,
        checks: [
          { name: "server_binary_present", ok: execution.server.binaryChecked ? execution.server.binaryFound === true : null },
          { name: "process_supervision_probe", ok: execution.processSupervision?.attempted ? execution.processSupervision?.started === true : null },
          { name: "initialize_shutdown_handshake", ok: execution.lifecycleAction === "handshake" ? execution.processSupervision?.protocolHandshake?.ok === true : null },
          { name: "didopen_source_transfer", ok: execution.lifecycleAction === SOURCE_TRANSFER_ACTION ? execution.processSupervision?.protocolHandshake?.didOpenSent === true : null },
          { name: "symbol_request", ok: execution.lifecycleAction === SYMBOL_REQUEST_ACTION ? execution.processSupervision?.protocolHandshake?.symbolRequestsSent === true : null },
          { name: "lifecycle_state_recorded", ok: Boolean(lifecycleState) },
        ],
        failedChecks: [],
      },
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      execution,
    };
  }

  return [
    { name: "native-engineering-lsp-lifecycle", predicate: isNativeEngineeringLspLifecycleTask, execute: executeNativeEngineeringLspLifecycleTask },
  ];
}
