import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { accessSync, constants, realpathSync } from "node:fs";
import path from "node:path";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { recordNativeEngineeringLspLifecycleExecution } from "./native-engineering-lsp-lifecycle-state.mjs";
import {
  createLspInitializeShutdownHandshake,
  shouldRunLspInitializeShutdownHandshake,
} from "./native-engineering-lsp-protocol-handshake.mjs";

export const NATIVE_ENGINEERING_LSP_LIFECYCLE_TASK_REGISTRY = "openclaw-native-engineering-lsp-lifecycle-task-v0";
export const NATIVE_ENGINEERING_LSP_LIFECYCLE_EXECUTION_REGISTRY = "openclaw-native-engineering-lsp-lifecycle-execution-v0";

const DEFAULT_PROCESS_PROBE_MS = 300;
const MAX_PROCESS_PROBE_MS = 2_000;
const DEFAULT_PROCESS_OUTPUT_CHARS = 4_096;
const PROCESS_SUPERVISION_ACTIONS = new Set(["start", "restart", "recover", "handshake"]);
const BINARY_GATE_ACTIONS = new Set(["start", "restart", "recover", "handshake"]);

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

export function createNativeEngineeringLspLifecycleTaskBuilders({
  autonomyMode,
  buildNativeEngineeringLspLifecycleDraft,
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
    confirm = false,
  } = {}) {
    if (confirm !== true) {
      throw new Error("Native engineering LSP lifecycle task creation requires confirm=true.");
    }

    const draft = buildNativeEngineeringLspLifecycleDraft({
      workspacePath,
      language,
      lifecycleAction,
    });
    const now = new Date().toISOString();
    const goal = `Run approved OpenClaw LSP lifecycle ${draft.query.lifecycleAction} gate for ${draft.query.language}`;
    const policyRequest = buildPolicyRequest();
    const policyDecision = buildPolicyDecision({ now, goal, autonomyMode });
    const plan = buildLifecyclePlan({ buildRulePlan, goal, policyRequest, draft });

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
    task.engineeringLspLifecycle = buildTaskMetadata(draft);
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
      mode: "approval-gated-lsp-lifecycle-binary-gate",
      generatedAt: new Date().toISOString(),
      sourceRegistry: draft.registry,
      lifecycleDraft: {
        registry: draft.registry,
        mode: draft.mode,
        id: draft.lifecycleDraft.id,
        readinessGates: draft.readinessGates,
      },
      engineeringLspLifecycle: task.engineeringLspLifecycle,
      task,
      approval,
      governance: {
        createsTask: true,
        createsApproval: true,
        canExecuteWithoutApproval: false,
        canStartProcessWithoutApproval: false,
        canSendJsonRpcRequest: false,
        contentExposed: false,
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
      jsonRpcOperationalRequestsEnabled: false,
      contentExposed: false,
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
    const processProbe = executablePath && shouldRunProcessSupervisionProbe(task.engineeringLspLifecycle ?? {})
      ? await startSupervisedLifecycleProcess({
          executablePath,
          args: task.engineeringLspLifecycle?.server?.serverArgs ?? [],
          cwd: resolveSupervisionCwd(task.engineeringLspLifecycle ?? {}, workspaceRoots).cwd,
          probeMs: shouldRunLspInitializeShutdownHandshake(task.engineeringLspLifecycle ?? {}) ? 1_000 : DEFAULT_PROCESS_PROBE_MS,
          protocolHandshake: shouldRunLspInitializeShutdownHandshake(task.engineeringLspLifecycle ?? {})
            ? createLspInitializeShutdownHandshake({
                workspacePath: task.engineeringLspLifecycle?.workspace?.path ?? null,
              })
            : null,
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
      },
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
            { name: "lifecycle_state_recorded", ok: Boolean(lifecycleState) },
          ],
          failedChecks: execution.result.failureKind === "lsp_initialize_shutdown_handshake_failed"
            ? ["initialize_shutdown_handshake"]
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
