import { projectAiCompositorFrame } from "../../../packages/shared-utils/src/ai-compositor-frame.mjs";
import {
  buildProviderWorkViewSemanticScene,
  normaliseWorkViewSemanticScene,
} from "../../../packages/shared-utils/src/work-view-semantic-scene.mjs";

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 720;
const SOCKET_NAME = "nixsoma-ai-0";

export function stableAiWorkspaceJson(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableAiWorkspaceJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableAiWorkspaceJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function boundedInteger(value) {
  return Number.isInteger(value) && value > 0 && value <= 0xffff_ffff ? value : null;
}

function activeSurface(inventory) {
  if (inventory?.available !== true
    || inventory.socketName !== SOCKET_NAME
    || !Number.isInteger(inventory.sequence)
    || inventory.sequence < 1
    || !Array.isArray(inventory.surfaces)) return null;
  const active = inventory.surfaces.filter((surface) => surface?.activated === true);
  if (active.length !== 1) return null;
  const surface = active[0];
  const surfaceId = boundedInteger(surface.surfaceId);
  if (!surfaceId || !boundedInteger(surface.width) || !boundedInteger(surface.height)) return null;
  return {
    surfaceId,
    pid: boundedInteger(surface.pid),
    width: surface.width,
    height: surface.height,
  };
}

export function buildAiWorkspaceProviderContext({
  registry,
  observedAt,
  context,
  taskObjective,
  requestedBehavior,
} = {}) {
  const { workView, frame, inventory, surface, providerScene } = context ?? {};
  const helper = workView?.helperRuntime;
  return {
    registry,
    observedAt,
    workspace: {
      prepared: workView?.status === "prepared",
      actionAuthority: helper?.actionAuthority === "active",
      leaseMatched: helper?.leaseMatched === true,
      browserAttached: workView?.aiGraphicalSession?.browserAttachment?.attached === true,
      socketName: SOCKET_NAME,
      frame: {
        available: true,
        fresh: true,
        width: frame?.width,
        height: frame?.height,
        sequence: frame?.sequence,
      },
      inventory: {
        available: true,
        sequence: inventory?.sequence,
        count: inventory?.count,
        activeSurface: {
          surfaceId: surface?.surfaceId,
          width: surface?.width,
          height: surface?.height,
        },
      },
      semanticScene: providerScene,
    },
    taskObjective,
    requestedBehavior,
    exclusions: {
      pixels: true,
      frameHash: true,
      titles: true,
      appIds: true,
      processIds: true,
      urls: true,
      existingInputValues: true,
      callerInputText: true,
      persistedInputText: true,
      commands: true,
      filePaths: true,
      credentials: true,
      callerPrompt: true,
      semanticFrameHash: true,
      browserPid: true,
      targetIds: true,
      selectors: true,
      inputValues: true,
      rawTaskGoal: true,
      taskIds: true,
      taskMetadata: true,
      taskPaths: true,
    },
  };
}

export function createAiWorkspaceContextObserver({
  fetchJson,
  sessionManagerUrl,
  screenSenseUrl,
} = {}) {
  return async function observeAiWorkspaceContext(observedAt) {
    const [frameResponse, stateResponse, sceneResponse] = await Promise.all([
      fetchJson(`${sessionManagerUrl}/work-view/compositor-frame`),
      fetchJson(`${sessionManagerUrl}/work-view/state`),
      fetchJson(`${screenSenseUrl}/screen/semantic-scene`),
    ]);
    const workView = stateResponse?.workView;
    const graphical = workView?.aiGraphicalSession;
    const helper = workView?.helperRuntime;
    const inventory = graphical?.surfaceInventory;
    const validationNow = Date.parse(observedAt);
    const frame = projectAiCompositorFrame(frameResponse?.frame, {
      includeData: false,
      now: validationNow,
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    });
    const surface = activeSurface(inventory);
    const scene = normaliseWorkViewSemanticScene(sceneResponse?.scene, {
      now: validationNow,
    });
    const providerScene = buildProviderWorkViewSemanticScene(scene);
    if (workView?.status !== "prepared"
      || helper?.status !== "active"
      || helper.actionAuthority !== "active"
      || helper.leaseMatched !== true
      || graphical?.ready !== true
      || graphical.browserAttachment?.attached !== true
      || frame.available !== true
      || frame.fresh !== true
      || frame.socketName !== SOCKET_NAME
      || !surface
      || !surface.pid
      || !scene
      || !providerScene
      || scene.browserPid !== surface.pid) {
      throw new Error("AI workspace context is not ready.");
    }
    return {
      frame,
      inventory,
      inventorySequence: inventory.sequence,
      surface,
      scene,
      providerScene,
      workView,
      workViewState: stateResponse,
    };
  };
}
