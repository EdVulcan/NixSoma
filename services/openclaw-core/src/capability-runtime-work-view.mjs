import {
  buildNativeEngineeringWorkViewAssociation,
  readNativeEngineeringWorkViewState,
} from "./native-engineering-work-view-association.mjs";
import { executeNativeEngineeringWorkViewBind } from "./native-engineering-work-view-bind-operation.mjs";

const CAPABILITY_ID = "sense.openclaw.engineering_context.work_view_observation";
const CONTROL_CAPABILITY_ID = "act.work_view.control";
const BIND_CAPABILITY_ID = "act.openclaw.engineering_context.work_view_bind";
const CONTROL_REGISTRY = "openclaw-native-work-view-control-v0";
const MAX_TASK_ID_CHARS = 200;
const MAX_CONTROL_OPERATION_CHARS = 80;
const MAX_DISPLAY_TARGET_CHARS = 120;
const MAX_ENTRY_URL_CHARS = 2_048;

const CONTROL_OPERATIONS = new Map([
  ["work_view.prepare", { action: "prepare_work_view", route: "/work-view/prepare" }],
  ["work_view.reveal", { action: "reveal_work_view", route: "/work-view/reveal" }],
  ["work_view.hide", { action: "hide_work_view", route: "/work-view/hide" }],
]);

const PUBLIC_WORK_VIEW_STATUSES = ["prepared", "ready", "degraded", "stopped"];
const PUBLIC_WORK_VIEW_VISIBILITIES = ["hidden", "visible"];
const PUBLIC_WORK_VIEW_MODES = ["background", "foreground-observable"];
const PUBLIC_HELPER_STATUSES = ["active", "degraded", "inactive"];
const PUBLIC_BROWSER_STATUSES = ["running", "stopped", "degraded"];
const PUBLIC_RECOVERY_ACTIONS = [
  "none",
  "prepare_work_view",
  "reveal_work_view",
  "hide_work_view",
  "resume_ai_action_authority",
  "restart_approved_trusted_sidecar",
];

function normaliseTaskId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error("Trusted work-view observation taskId must be a string.");
  }
  const taskId = value.trim();
  if (!taskId) return null;
  if (taskId.length > MAX_TASK_ID_CHARS) {
    throw new Error("Trusted work-view observation taskId is too long.");
  }
  return taskId;
}

function findTask(tasks, taskId) {
  if (!taskId) return null;
  if (tasks instanceof Map) return tasks.get(taskId) ?? null;
  if (Array.isArray(tasks)) return tasks.find((task) => task?.id === taskId) ?? null;
  return null;
}

function normaliseBoundedText(value, label, maxChars) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  const text = value.trim();
  if (!text) return null;
  if (text.length > maxChars) {
    throw new Error(`${label} is too long.`);
  }
  return text;
}

function normaliseEntryUrl(value) {
  const entryUrl = normaliseBoundedText(value, "Trusted work-view control entryUrl", MAX_ENTRY_URL_CHARS);
  if (!entryUrl) return null;
  let parsed;
  try {
    parsed = new URL(entryUrl);
  } catch {
    throw new Error("Trusted work-view control entryUrl must be an absolute HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Trusted work-view control entryUrl must be an HTTP(S) URL without credentials.");
  }
  return parsed.toString();
}

function normaliseControlRequest(request) {
  const params = request.params ?? {};
  const operation = normaliseBoundedText(
    request.operation ?? request.intent ?? params.operation ?? params.action,
    "Trusted work-view control operation",
    MAX_CONTROL_OPERATION_CHARS,
  );
  if (!operation) {
    throw new Error("Trusted work-view control operation is required.");
  }
  const selected = CONTROL_OPERATIONS.get(operation);
  if (!selected) {
    throw new Error("Trusted work-view control operation is not allowlisted.");
  }

  const payload = {
    operatorActionSource: "capability_runtime_work_view_control",
    recommendedAction: selected.action,
  };
  if (selected.action === "prepare_work_view") {
    const displayTarget = normaliseBoundedText(
      params.displayTarget,
      "Trusted work-view control displayTarget",
      MAX_DISPLAY_TARGET_CHARS,
    );
    const entryUrl = normaliseEntryUrl(params.entryUrl);
    if (displayTarget) payload.displayTarget = displayTarget;
    if (entryUrl) payload.entryUrl = entryUrl;
  }
  if (selected.action === "reveal_work_view") {
    const entryUrl = normaliseEntryUrl(params.entryUrl);
    if (entryUrl) payload.entryUrl = entryUrl;
  }
  return { ...selected, operation, payload };
}

function publicEnum(value, allowed) {
  return allowed.includes(value) ? value : null;
}

function projectControlResult(action, response) {
  const workView = response?.workView ?? {};
  const trustedSession = workView.trustedSession ?? {};
  const result = {
    ok: response?.ok === true,
    registry: CONTROL_REGISTRY,
    action,
    workView: {
      status: publicEnum(workView.status, PUBLIC_WORK_VIEW_STATUSES),
      visibility: publicEnum(workView.visibility, PUBLIC_WORK_VIEW_VISIBILITIES),
      mode: publicEnum(workView.mode, PUBLIC_WORK_VIEW_MODES),
      helperStatus: publicEnum(workView.helperStatus, PUBLIC_HELPER_STATUSES),
      browserStatus: publicEnum(workView.browserStatus, PUBLIC_BROWSER_STATUSES),
      recoveryAction: publicEnum(
        trustedSession.recoveryRecommendation?.action,
        PUBLIC_RECOVERY_ACTIONS,
      ) ?? "none",
    },
    governance: {
      mutatesWorkViewState: true,
      dispatchesExistingOwnerAction: true,
      browserNavigation: action !== "hide_work_view",
      createsTask: false,
      createsApproval: false,
      callsProvider: false,
      providerEgress: false,
      exposesSessionId: false,
      exposesLeaseId: false,
      exposesActiveUrl: false,
      exposesCapturePayload: false,
      exposesBrowserPayload: false,
    },
  };
  return result;
}

function resolveTaskId(params, request) {
  const requestTaskId = normaliseTaskId(request.taskId);
  const parameterTaskId = normaliseTaskId(params.taskId);
  if (requestTaskId && parameterTaskId && requestTaskId !== parameterTaskId) {
    throw new Error("Trusted work-view observation taskId must match the request taskId.");
  }
  return parameterTaskId ?? requestTaskId;
}

export function createEngineeringWorkViewCapabilityHandlers({
  tasks = new Map(),
  taskManager = {},
  sessionManagerUrl,
  fetchImpl = globalThis.fetch,
  postJson = async () => {
    throw new Error("Trusted work-view control transport is not configured.");
  },
  readWorkViewState = readNativeEngineeringWorkViewState,
  publishEvent = async () => {},
} = {}) {
  async function callBackend(capability, request) {
    if (capability.id === CONTROL_CAPABILITY_ID) {
      const control = normaliseControlRequest(request);
      const response = await postJson(`${sessionManagerUrl}${control.route}`, control.payload);
      return {
        handled: true,
        result: projectControlResult(control.action, response),
      };
    }
    if (capability.id === BIND_CAPABILITY_ID) {
      const bind = normaliseBindRequest(request);
      const response = await executeNativeEngineeringWorkViewBind({
        taskManager,
        taskId: bind.taskId,
        confirm: bind.confirm,
        rebind: bind.rebind,
        publishEvent,
        sessionManagerUrl,
        fetchImpl,
        readWorkViewState,
        serialiseTask: taskManager.serialiseTask,
        operatorActionSource: "capability_runtime_engineering_context",
      });
      return {
        handled: true,
        result: response.body,
      };
    }
    if (capability.id !== CAPABILITY_ID) {
      return { handled: false, result: null };
    }

    const params = request.params ?? {};
    const taskId = resolveTaskId(params, request);
    const task = findTask(tasks, taskId);
    if (taskId && !task) {
      throw new Error("Trusted work-view observation task does not exist.");
    }

    const workViewRead = await readWorkViewState({ sessionManagerUrl, fetchImpl });
    return {
      handled: true,
      result: buildNativeEngineeringWorkViewAssociation({
        task,
        taskId,
        workViewState: workViewRead.data,
        readStatus: workViewRead.ok ? "available" : "unavailable",
        includeWorkViewObservation: true,
      }),
    };
  }

  function summariseResult(capability, result) {
    if (capability.id === CONTROL_CAPABILITY_ID) {
      const workView = result?.workView ?? {};
      const governance = result?.governance ?? {};
      return {
        kind: "work_view.control",
        ok: result?.ok === true,
        action: result?.action ?? null,
        status: workView.status ?? null,
        visibility: workView.visibility ?? null,
        recoveryAction: workView.recoveryAction ?? "none",
        mutatesWorkViewState: governance.mutatesWorkViewState === true,
        browserNavigation: governance.browserNavigation === true,
        noProviderEgress: governance.providerEgress === false,
        noPayloadExposure: governance.exposesLeaseId === false
          && governance.exposesActiveUrl === false
          && governance.exposesCapturePayload === false
          && governance.exposesBrowserPayload === false,
      };
    }
    if (capability.id === BIND_CAPABILITY_ID) {
      const bind = result?.bind ?? {};
      const summary = bind.summary ?? {};
      const governance = bind.governance ?? {};
      return {
        kind: "engineering.work_view_bind",
        ok: result?.ok === true,
        blocked: result?.ok !== true,
        taskId: result?.task?.id ?? summary.taskId ?? null,
        taskStatus: result?.task?.status ?? null,
        status: summary.status ?? null,
        operation: summary.operation ?? null,
        changed: result?.changed === true,
        taskStatusPreserved: governance.changesTaskStatus === false,
        noWorkViewMutation: governance.mutatesWorkViewState === false,
        noProviderEgress: governance.callsProvider === false
          && governance.networkEgress === false,
        noPayloadExposure: governance.exposesSessionId === false
          && governance.exposesLeaseId === false
          && governance.exposesActiveUrl === false,
      };
    }
    if (capability.id !== CAPABILITY_ID) return null;
    const summary = result?.summary ?? {};
    const observation = result?.observation ?? {};
    const governance = result?.governance ?? {};
    return {
      kind: "engineering.work_view_observation",
      ok: result?.ok === true,
      taskId: summary.taskId ?? null,
      status: summary.status ?? null,
      bindingStatus: summary.bindingStatus ?? null,
      helperStatus: summary.helperStatus ?? null,
      actionAuthority: summary.actionAuthority ?? null,
      leaseMatched: summary.leaseMatched === true,
      recoveryAction: summary.recoveryAction ?? "none",
      observationStatus: summary.workViewObservationStatus ?? observation.status ?? null,
      observationFreshness: summary.workViewObservationFreshness ?? observation.freshness ?? null,
      observationSequence: summary.workViewObservationSequence ?? observation.sequence ?? null,
      semanticTargetCount: summary.semanticTargetCount ?? observation.semanticTargets?.itemCount ?? null,
      readsTrustedWorkViewObservation: governance.readsTrustedWorkViewObservation === true,
      noPayloadExposure: governance.exposesLeaseId === false
        && governance.exposesActiveUrl === false
        && governance.exposesCapturePayload === false
        && governance.exposesVisualFrameBytes === false
        && governance.exposesSemanticTargetItems === false,
    };
  }

  function validateRequest(capability, request) {
    if (![CAPABILITY_ID, CONTROL_CAPABILITY_ID, BIND_CAPABILITY_ID].includes(capability.id)) return null;
    try {
      if (capability.id === CONTROL_CAPABILITY_ID) {
        normaliseControlRequest(request);
      } else if (capability.id === BIND_CAPABILITY_ID) {
        normaliseBindRequest(request);
      } else {
        resolveTaskId(request.params ?? {}, request);
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid trusted work-view capability request.";
    }
  }

  return { callBackend, summariseResult, validateRequest };
}

function normaliseBindRequest(request) {
  const params = request.params ?? {};
  const taskId = resolveTaskId(params, request);
  if (!taskId) {
    throw new Error("Trusted work-view bind taskId is required.");
  }
  if (params.confirm !== undefined && typeof params.confirm !== "boolean") {
    throw new Error("Trusted work-view bind confirm must be a boolean.");
  }
  if (params.rebind !== undefined && typeof params.rebind !== "boolean") {
    throw new Error("Trusted work-view bind rebind must be a boolean.");
  }
  return {
    taskId,
    confirm: params.confirm === true,
    rebind: params.rebind === true,
  };
}
