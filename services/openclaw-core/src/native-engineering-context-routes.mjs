import { readJsonBody, sendJson } from "../../../packages/shared-utils/src/http.mjs";
import { buildNativeEngineeringMicrocompactProjection } from "./native-engineering-microcompact-projection.mjs";

const MICROCOMPACT_PROJECTION_PATH = "/plugins/native-adapter/engineering-microcompact/projection";

export async function handleNativeEngineeringContextRoute({ req, res, requestUrl, publishEvent }) {
  if (requestUrl.pathname !== MICROCOMPACT_PROJECTION_PATH) return false;
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed." });
    return true;
  }

  try {
    const body = await readJsonBody(req, 600_000);
    const projection = buildNativeEngineeringMicrocompactProjection({
      messages: body.messages,
      thresholdChars: body.thresholdChars,
      protectRecentAssistantTurns: body.protectRecentAssistantTurns,
    });
    const auditResult = await publishEvent?.("native_engineering.microcompact_projection_built", projection.auditEvidence);
    if (auditResult?.ok === false) {
      sendJson(res, 503, { ok: false, error: "Microcompact projection audit is unavailable." });
      return true;
    }
    sendJson(res, 200, projection);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
  return true;
}
