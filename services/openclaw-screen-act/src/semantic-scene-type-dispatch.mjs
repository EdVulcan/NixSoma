import {
  WORK_VIEW_SEMANTIC_SCENE_MAX_ITEMS,
  resolveWorkViewSemanticSceneType,
} from "../../../packages/shared-utils/src/work-view-semantic-scene.mjs";
import {
  buildWriteOnlyInputEvidence,
} from "../../../packages/shared-utils/src/work-view-input-evidence.mjs";
import { projectWorkViewVisualFrame } from "../../../packages/shared-utils/src/work-view-visual-frame.mjs";

export const SEMANTIC_SCENE_TYPE_REGISTRY =
  "nixsoma-ai-browser-semantic-scene-type-dispatch-v0";

const ACTION_KEYS = new Set([
  "sceneContentSha256", "itemOrdinal", "browserPid", "semanticFrame", "text",
]);
const FRAME_KEYS = new Set(["sha256", "sequence"]);
const INPUT_EVIDENCE_KEYS = new Set([
  "registry", "charCount", "byteLength", "maxChars", "truncated", "textExposed", "persisted",
]);

function exactKeys(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.has(key))
    && Object.keys(value).length === allowed.size;
}

function inputEvidenceMatches(actual, expected) {
  return exactKeys(actual, INPUT_EVIDENCE_KEYS)
    && [...INPUT_EVIDENCE_KEYS].every((key) => actual[key] === expected[key]);
}

export function normaliseSemanticSceneTypeAction(action) {
  const frame = action?.semanticFrame;
  const input = buildWriteOnlyInputEvidence(action?.text);
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
    || frame.sequence < 1
    || typeof action.text !== "string"
    || input.text.length < 1
    || input.evidence.truncated) {
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
    text: input.text,
    inputEvidence: input.evidence,
  };
}

function publicResult(action, overrides = {}) {
  return {
    registry: SEMANTIC_SCENE_TYPE_REGISTRY,
    attempted: false,
    required: true,
    accepted: false,
    status: "blocked",
    reason: "semantic_scene_type_blocked",
    leaseMatched: false,
    transport: "browser-runtime-direct",
    semanticType: {
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
      inputEvidence: action?.inputEvidence ?? null,
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

export function createSemanticSceneTypeDispatch({
  browserRuntimeUrl,
  browserRuntimeHeaders = () => ({}),
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  return async function dispatchSemanticSceneType({ action, trustedHelperLease } = {}) {
    const boundedAction = normaliseSemanticSceneTypeAction(action);
    if (!boundedAction) return publicResult(null, { reason: "semantic_scene_type_action_invalid" });

    let before;
    try {
      before = await readCapture({ browserRuntimeUrl, browserRuntimeHeaders, fetchImpl });
    } catch {
      before = null;
    }
    if (!before) return publicResult(boundedAction, { reason: "semantic_scene_capture_unavailable" });

    const resolution = resolveWorkViewSemanticSceneType({
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
        semanticType: {
          ...publicResult(boundedAction).semanticType,
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

    let typeResponse;
    let typeData;
    try {
      typeResponse = await fetchImpl(`${browserRuntimeUrl}/browser/input`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...browserRuntimeHeaders(),
        },
        body: JSON.stringify({
          text: boundedAction.text,
          semanticTarget: resolution.semanticTarget,
          trustedHelperLease,
        }),
      });
      typeData = await typeResponse.json().catch(() => null);
    } catch {
      typeResponse = null;
      typeData = null;
    }

    const actionExecuted = typeResponse?.ok === true
      && typeData?.ok === true
      && typeData.mediation?.accepted === true
      && typeData.mediation?.leaseMatched === true
      && typeData.effect?.operation === "type"
      && typeData.effect?.status === "executed"
      && typeData.effect?.targetId === resolution.semanticTarget.targetId
      && typeData.effect?.inventorySha256 === resolution.semanticTarget.inventorySha256
      && typeData.effect?.frame?.sha256 === resolution.semanticTarget.frame.sha256
      && typeData.effect?.frame?.sequence === resolution.semanticTarget.frame.sequence
      && inputEvidenceMatches(typeData.inputEvidence, boundedAction.inputEvidence)
      && inputEvidenceMatches(typeData.effect?.inputEvidence, boundedAction.inputEvidence);
    if (!actionExecuted) {
      return publicResult(boundedAction, {
        attempted: true,
        status: "rejected",
        reason: typeof typeData?.error === "string" ? typeData.error.slice(0, 80) : "semantic_scene_type_rejected",
        leaseMatched: typeData?.mediation?.leaseMatched === true,
        semanticType: {
          ...resolution.evidence,
          sceneContentHash: resolution.evidence.sceneContentSha256,
          actionExecuted: false,
          postActionVerified: false,
          postFrameSequenceAdvanced: false,
          postFrameChanged: false,
          inputEvidence: boundedAction.inputEvidence,
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
      reason: postActionVerified ? null : "semantic_scene_type_post_capture_unavailable",
      leaseMatched: typeData.mediation?.leaseMatched === true,
      semanticType: {
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
        inputEvidence: boundedAction.inputEvidence,
      },
    });
  };
}
