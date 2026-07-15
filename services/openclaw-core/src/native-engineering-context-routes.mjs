import { readJsonBody, sendJson } from "../../../packages/shared-utils/src/http.mjs";
import { buildNativeEngineeringMicrocompactProjection } from "./native-engineering-microcompact-projection.mjs";
import {
  buildNativeEngineeringContextPacketReadModel,
} from "./native-engineering-context-packet-assembly.mjs";
import { readNativeEngineeringWorkViewState } from "./native-engineering-work-view-association.mjs";

const MICROCOMPACT_PROJECTION_PATH = "/plugins/native-adapter/engineering-microcompact/projection";
const ENGINEERING_CONTEXT_PACKET_PATH = "/plugins/native-adapter/engineering-context/packet";

async function publishAuditOrFail({ res, publishEvent, type, auditEvidence }) {
  const result = await publishEvent?.(type, auditEvidence);
  if (result?.ok === false) {
    sendJson(res, 503, { ok: false, error: "Engineering context audit is unavailable." });
    return false;
  }
  return true;
}

export async function handleNativeEngineeringContextRoute({
  req,
  res,
  requestUrl,
  state,
  executor,
  planBuilder,
  publishEvent,
  sessionManagerUrl,
  readWorkViewState = readNativeEngineeringWorkViewState,
}) {
  if (![MICROCOMPACT_PROJECTION_PATH, ENGINEERING_CONTEXT_PACKET_PATH].includes(requestUrl.pathname)) return false;
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed." });
    return true;
  }

  try {
    const body = await readJsonBody(req, 600_000);
    if (requestUrl.pathname === ENGINEERING_CONTEXT_PACKET_PATH) {
      const packet = await buildNativeEngineeringContextPacketReadModel({
        params: body,
        tasks: state.tasks,
        runtimeState: state.runtimeState,
        workbenchRecords: state.nativeEngineeringPlanTodoWorkbenchRecords,
        listCommandTranscriptRecords: (options) => executor.listCommandTranscriptRecords(options),
        listCapabilityInvocations: (options) => planBuilder.listCapabilityInvocations(options),
        sessionManagerUrl,
        readWorkViewState,
      });
      if (!await publishAuditOrFail({
        res,
        publishEvent,
        type: "native_engineering.context_packet_built",
        auditEvidence: packet.auditEvidence,
      })) return true;
      sendJson(res, 200, packet);
      return true;
    }
    const projection = buildNativeEngineeringMicrocompactProjection({
      messages: body.messages,
      thresholdChars: body.thresholdChars,
      protectRecentAssistantTurns: body.protectRecentAssistantTurns,
    });
    if (!await publishAuditOrFail({
      res,
      publishEvent,
      type: "native_engineering.microcompact_projection_built",
      auditEvidence: projection.auditEvidence,
    })) return true;
    sendJson(res, 200, projection);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
  return true;
}
