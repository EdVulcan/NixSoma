import { readJsonBody, sendJson } from "../../../packages/shared-utils/src/http.mjs";
import { buildNativeEngineeringMicrocompactProjection } from "./native-engineering-microcompact-projection.mjs";
import { buildNativeEngineeringContextPacket } from "./native-engineering-context-packet.mjs";
import { buildNativeEngineeringPlanTodoEvidence } from "./native-engineering-plan-todo-evidence-builders.mjs";
import { buildNativeEngineeringRecoveryEvidence } from "./native-engineering-recovery-evidence-builders.mjs";
import { buildNativeEngineeringVerificationEvidence } from "./native-engineering-verification-evidence-builders.mjs";
import {
  buildNativeEngineeringWorkViewAssociation,
  readNativeEngineeringWorkViewState,
} from "./native-engineering-work-view-association.mjs";

const MICROCOMPACT_PROJECTION_PATH = "/plugins/native-adapter/engineering-microcompact/projection";
const ENGINEERING_CONTEXT_PACKET_PATH = "/plugins/native-adapter/engineering-context/packet";

function taskForId(tasks, taskId) {
  if (!taskId) return null;
  if (tasks instanceof Map) return tasks.get(taskId) ?? null;
  return Array.isArray(tasks) ? tasks.find((task) => task?.id === taskId) ?? null : null;
}

function positiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

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
      const limit = positiveInteger(body.limit, 12, 30);
      const taskId = typeof body.taskId === "string" && body.taskId.trim() ? body.taskId.trim() : null;
      const sourceTaskId = typeof body.sourceTaskId === "string" && body.sourceTaskId.trim()
        ? body.sourceTaskId.trim()
        : null;
      const selectedSourceTaskId = sourceTaskId ?? taskId;
      if (sourceTaskId && !taskForId(state.tasks, sourceTaskId)) {
        throw new Error("Engineering context source task does not exist.");
      }
      const transcriptRecords = executor.listCommandTranscriptRecords({ limit: selectedSourceTaskId ? 100 : limit });
      const verificationEvidence = buildNativeEngineeringVerificationEvidence({
        transcriptRecords,
        capabilityInvocations: planBuilder.listCapabilityInvocations({
          limit: 100,
          capabilityId: "act.system.command.execute",
        }),
        tasks: state.tasks,
        taskId: selectedSourceTaskId,
        limit,
        maxOutputChars: body.maxOutputChars,
      });
      const recoveryEvidence = buildNativeEngineeringRecoveryEvidence({
        verificationEvidence,
        tasks: state.tasks,
        taskId: selectedSourceTaskId,
        limit,
      });
      const selectedTaskId = selectedSourceTaskId ?? state.runtimeState?.currentTaskId ?? null;
      let workViewAssociation = null;
      if (body.includeWorkView === true) {
        const workViewRead = await readWorkViewState({ sessionManagerUrl });
        workViewAssociation = buildNativeEngineeringWorkViewAssociation({
          task: taskForId(state.tasks, selectedTaskId),
          taskId: selectedTaskId,
          workViewState: workViewRead.data,
          readStatus: workViewRead.ok ? "available" : "unavailable",
          includeWorkViewObservation: body.includeWorkViewObservation === true,
        });
      }
      const planTodoEvidence = body.includePlanTodo === true
        ? buildNativeEngineeringPlanTodoEvidence({
            tasks: state.tasks,
            runtimeState: state.runtimeState,
            workbenchRecords: state.nativeEngineeringPlanTodoWorkbenchRecords,
            taskId: selectedSourceTaskId,
            limit,
          })
        : null;
      const packet = buildNativeEngineeringContextPacket({
        transcriptRecords,
        tasks: state.tasks,
        verificationEvidence,
        recoveryEvidence,
        taskId,
        sourceTaskId,
        limit,
        maxOutputChars: body.maxOutputChars,
        thresholdChars: body.thresholdChars,
        protectRecentAssistantTurns: body.protectRecentAssistantTurns,
        workViewAssociation,
        planTodoEvidence,
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
