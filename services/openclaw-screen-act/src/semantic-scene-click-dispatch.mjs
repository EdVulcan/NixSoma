import {
  WORK_VIEW_SEMANTIC_SCENE_MAX_ITEMS,
  resolveWorkViewSemanticSceneClick,
} from "../../../packages/shared-utils/src/work-view-semantic-scene.mjs";
import { projectWorkViewVisualFrame } from "../../../packages/shared-utils/src/work-view-visual-frame.mjs";

export const SEMANTIC_SCENE_CLICK_REGISTRY =
  "nixsoma-ai-browser-semantic-scene-click-dispatch-v0";

const ACTION_KEYS = new Set([
  "sceneContentSha256", "itemOrdinal", "browserPid", "semanticFrame",
]);
const FRAME_KEYS = new Set(["sha256", "sequence"]);

function exactKeys(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.has(key))
    && Object.keys(value).length === allowed.size;
}

export function normaliseSemanticSceneClickAction(action) {
  const frame = action?.semanticFrame;
  if (!exactKeys(action, ACTION_KEYS)
    || !/^[a-f0-9]{64}$/u.test(action.sceneContentSha256)
    || !Number.isInteger(action.itemOrdinal)
    || action.itemOrdinal < 1
    || action.itemOrdinal > WORK_VIEW_SEMANTIC_SCENE_MAX_ITEMS
    || !Number.isInteger(action.browserPid)
    || action.browserPid < 1
    || !exactKeys(frame, FRAME_KEYS)
    || !/^[a-f0-9]{64}$/u.test(frame.sha256)
    || !Number.isInteger(frame.sequence)
    || frame.sequence < 1) {
    return null;
  }
  return {
    sceneContentSha256: action.sceneContentSha256,
    itemOrdinal: action.itemOrdinal,
    browserPid: action.browserPid,
    semanticFrame: {
      sha256: frame.sha256,
      sequence: frame.sequence,
    },
  };
}

function publicResult(action, overrides = {}) {
  return {
    registry: SEMANTIC_SCENE_CLICK_REGISTRY,
    attempted: false,
    required: true,
    accepted: false,
    status: "blocked",
    reason: "semantic_scene_click_blocked",
    leaseMatched: false,
    transport: "browser-runtime-direct",
    semanticClick: {
      sceneContentHash: action?.sceneContentSha256 ?? null,
      itemOrdinal: action?.itemOrdinal ?? null,
      itemCount: 0,
      browserMatched: false,
      frameMatched: false,
      sceneMatched: false,
      actionExecuted: false,
      postActionVerified: false,
      postFrameSequenceAdvanced: false,
      postFrameChanged: false,
    },
    ...overrides,
  };
}

async function readCapture({ browserRuntimeUrl, browserRuntimeHeaders, fetchImpl }) {
  const response = await fetchImpl(
    `${browserRuntimeUrl}/browser/capture?visual=metadata&semantic=items`,
    { headers: browserRuntimeHeaders() },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok !== true || data.running !== true || !data.capture || !data.browser) {
    return null;
  }
  return data;
}

export function createSemanticSceneClickDispatch({
  browserRuntimeUrl,
  browserRuntimeHeaders = () => ({}),
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  return async function dispatchSemanticSceneClick({ action, trustedHelperLease } = {}) {
    const boundedAction = normaliseSemanticSceneClickAction(action);
    if (!boundedAction) return publicResult(null, { reason: "semantic_scene_click_action_invalid" });

    let before;
    try {
      before = await readCapture({ browserRuntimeUrl, browserRuntimeHeaders, fetchImpl });
    } catch {
      before = null;
    }
    if (!before) return publicResult(boundedAction, { reason: "semantic_scene_capture_unavailable" });

    const resolution = resolveWorkViewSemanticSceneClick({
      browser: before.browser,
      capture: before.capture,
      expectedSceneContentSha256: boundedAction.sceneContentSha256,
      expectedBrowserPid: boundedAction.browserPid,
      expectedFrame: boundedAction.semanticFrame,
      itemOrdinal: boundedAction.itemOrdinal,
      now: now(),
    });
    if (!resolution.ok) {
      return publicResult(boundedAction, {
        reason: resolution.reason,
        semanticClick: {
          ...publicResult(boundedAction).semanticClick,
          itemCount: resolution.scene?.itemCount ?? 0,
          browserMatched: resolution.reason !== "semantic_scene_browser_changed",
          frameMatched: !["semantic_scene_browser_changed", "semantic_scene_frame_changed"]
            .includes(resolution.reason),
          sceneMatched: ![
            "semantic_scene_browser_changed", "semantic_scene_frame_changed", "semantic_scene_changed",
          ].includes(resolution.reason),
        },
      });
    }

    let clickResponse;
    let clickData;
    try {
      clickResponse = await fetchImpl(`${browserRuntimeUrl}/browser/click`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...browserRuntimeHeaders(),
        },
        body: JSON.stringify({
          semanticTarget: resolution.semanticTarget,
          trustedHelperLease,
        }),
      });
      clickData = await clickResponse.json().catch(() => null);
    } catch {
      clickResponse = null;
      clickData = null;
    }

    const actionExecuted = clickResponse?.ok === true
      && clickData?.ok === true
      && clickData.mediation?.accepted !== false
      && clickData.effect?.operation === "click"
      && clickData.effect?.status === "executed"
      && clickData.effect?.targetId === resolution.semanticTarget.targetId
      && clickData.effect?.inventorySha256 === resolution.semanticTarget.inventorySha256
      && clickData.effect?.frame?.sha256 === resolution.semanticTarget.frame.sha256
      && clickData.effect?.frame?.sequence === resolution.semanticTarget.frame.sequence;
    if (!actionExecuted) {
      return publicResult(boundedAction, {
        attempted: true,
        status: "rejected",
        reason: typeof clickData?.error === "string" ? clickData.error.slice(0, 80) : "semantic_scene_click_rejected",
        leaseMatched: clickData?.mediation?.leaseMatched === true,
        semanticClick: {
          ...resolution.evidence,
          sceneContentHash: resolution.evidence.sceneContentSha256,
          actionExecuted: false,
          postActionVerified: false,
          postFrameSequenceAdvanced: false,
          postFrameChanged: false,
        },
      });
    }

    let after;
    try {
      after = await readCapture({ browserRuntimeUrl, browserRuntimeHeaders, fetchImpl });
    } catch {
      after = null;
    }
    const postFrame = projectWorkViewVisualFrame(after?.capture?.visualFrame, {
      includeData: false,
      now: now(),
    });
    const postFrameSequenceAdvanced = postFrame.available === true
      && postFrame.fresh === true
      && postFrame.sequence > resolution.scene.frame.sequence;
    const postActionVerified = after?.browser?.browserPid === boundedAction.browserPid
      && postFrameSequenceAdvanced;

    return publicResult(boundedAction, {
      attempted: true,
      accepted: true,
      status: postActionVerified ? "executed" : "executed_post_capture_unavailable",
      reason: postActionVerified ? null : "semantic_scene_click_post_capture_unavailable",
      leaseMatched: clickData.mediation?.leaseMatched === true,
      semanticClick: {
        registry: resolution.evidence.registry,
        sceneContentHash: resolution.evidence.sceneContentSha256,
        itemOrdinal: resolution.itemOrdinal,
        itemCount: resolution.scene.itemCount,
        browserMatched: true,
        frameMatched: true,
        sceneMatched: true,
        actionExecuted: true,
        postActionVerified,
        postFrameSequenceAdvanced,
        postFrameChanged: postFrame.available === true
          && postFrame.sha256 !== resolution.scene.frame.sha256,
      },
    });
  };
}
