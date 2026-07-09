import { sendJson } from "../../../packages/shared-utils/src/http.mjs";
import { buildNativeEngineeringMicrocompactEvidence } from "./native-engineering-microcompact-evidence-builders.mjs";
import { buildNativeEngineeringPlanTodoEvidence } from "./native-engineering-plan-todo-evidence-builders.mjs";
import { buildNativeEngineeringRecoveryEvidence } from "./native-engineering-recovery-evidence-builders.mjs";
import { buildNativeEngineeringVerificationEvidence } from "./native-engineering-verification-evidence-builders.mjs";
import { buildNativeEngineeringWriteExecutionEvidence } from "./native-engineering-write-execution-evidence-builders.mjs";

function parseLimit(searchParams) {
  return Number.parseInt(searchParams.get("limit") ?? "20", 10);
}

function clampLedgerLimit(limit) {
  return Number.isNaN(limit) ? 20 : Math.max(1, Math.min(limit, 100));
}

export async function handleObserverReadModelRoute({ req, res, requestUrl, state, planBuilder, executor }) {
  if (req.method !== "GET") {
    return false;
  }

  if (requestUrl.pathname === "/capabilities") {
    const registry = await planBuilder.buildCapabilityRegistry();
    sendJson(res, 200, {
      ok: true,
      ...registry,
    });
    return true;
  }

  if (requestUrl.pathname === "/capabilities/summary") {
    const registry = await planBuilder.buildCapabilityRegistry();
    sendJson(res, 200, {
      ok: true,
      registry: registry.registry,
      mode: registry.mode,
      generatedAt: registry.generatedAt,
      summary: registry.summary,
    });
    return true;
  }

  if (requestUrl.pathname === "/capabilities/invocations") {
    const limit = parseLimit(requestUrl.searchParams);
    const capabilityId = requestUrl.searchParams.get("capabilityId") ?? null;
    sendJson(res, 200, {
      ok: true,
      count: state.capabilityInvocationLog.length,
      items: planBuilder.listCapabilityInvocations({
        limit: Number.isNaN(limit) ? 20 : limit,
        capabilityId,
      }),
      summary: planBuilder.buildCapabilityInvocationSummary(),
    });
    return true;
  }

  if (requestUrl.pathname === "/capabilities/invocations/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: planBuilder.buildCapabilityInvocationSummary(),
    });
    return true;
  }

  if (requestUrl.pathname === "/commands/transcripts") {
    const safeLimit = clampLedgerLimit(parseLimit(requestUrl.searchParams));
    const items = executor.listCommandTranscriptRecords({ limit: safeLimit });
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: executor.serialiseCommandTranscriptSummary(executor.buildCommandTranscriptSummary()),
    });
    return true;
  }

  if (requestUrl.pathname === "/commands/transcripts/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: executor.serialiseCommandTranscriptSummary(executor.buildCommandTranscriptSummary()),
    });
    return true;
  }

  if (requestUrl.pathname === "/plugins/native-adapter/engineering-verification/evidence") {
    const safeLimit = clampLedgerLimit(parseLimit(requestUrl.searchParams));
    const taskId = requestUrl.searchParams.get("taskId") ?? null;
    const maxOutputChars = requestUrl.searchParams.get("maxOutputChars");
    const transcriptLimit = taskId ? 100 : safeLimit;
    sendJson(res, 200, buildNativeEngineeringVerificationEvidence({
      transcriptRecords: executor.listCommandTranscriptRecords({ limit: transcriptLimit }),
      capabilityInvocations: planBuilder.listCapabilityInvocations({
        limit: 100,
        capabilityId: "act.system.command.execute",
      }),
      tasks: state.tasks,
      taskId,
      limit: safeLimit,
      maxOutputChars,
    }));
    return true;
  }

  if (requestUrl.pathname === "/plugins/native-adapter/engineering-recovery/evidence") {
    const safeLimit = clampLedgerLimit(parseLimit(requestUrl.searchParams));
    const taskId = requestUrl.searchParams.get("taskId") ?? null;
    const transcriptLimit = taskId ? 100 : safeLimit;
    const verificationEvidence = buildNativeEngineeringVerificationEvidence({
      transcriptRecords: executor.listCommandTranscriptRecords({ limit: transcriptLimit }),
      capabilityInvocations: planBuilder.listCapabilityInvocations({
        limit: 100,
        capabilityId: "act.system.command.execute",
      }),
      tasks: state.tasks,
      taskId,
      limit: safeLimit,
      maxOutputChars: requestUrl.searchParams.get("maxOutputChars"),
    });
    sendJson(res, 200, buildNativeEngineeringRecoveryEvidence({
      verificationEvidence,
      tasks: state.tasks,
      taskId,
      limit: safeLimit,
    }));
    return true;
  }

  if (requestUrl.pathname === "/plugins/native-adapter/engineering-microcompact/evidence") {
    const safeLimit = clampLedgerLimit(parseLimit(requestUrl.searchParams));
    const transcriptRecords = executor.listCommandTranscriptRecords({ limit: safeLimit });
    const verificationEvidence = buildNativeEngineeringVerificationEvidence({
      transcriptRecords,
      capabilityInvocations: planBuilder.listCapabilityInvocations({
        limit: 100,
        capabilityId: "act.system.command.execute",
      }),
      tasks: state.tasks,
      limit: safeLimit,
      maxOutputChars: requestUrl.searchParams.get("maxOutputChars"),
    });
    const recoveryEvidence = buildNativeEngineeringRecoveryEvidence({
      verificationEvidence,
      tasks: state.tasks,
      limit: safeLimit,
    });
    sendJson(res, 200, buildNativeEngineeringMicrocompactEvidence({
      transcriptRecords,
      verificationEvidence,
      recoveryEvidence,
      tasks: state.tasks,
      limit: safeLimit,
      thresholdChars: requestUrl.searchParams.get("thresholdChars"),
      protectRecentItems: requestUrl.searchParams.get("protectRecentItems"),
    }));
    return true;
  }

  if (requestUrl.pathname === "/plugins/native-adapter/engineering-plan-todo/evidence") {
    const safeLimit = clampLedgerLimit(parseLimit(requestUrl.searchParams));
    sendJson(res, 200, buildNativeEngineeringPlanTodoEvidence({
      tasks: state.tasks,
      runtimeState: state.runtimeState,
      taskId: requestUrl.searchParams.get("taskId"),
      planSummary: requestUrl.searchParams.get("planSummary"),
      confirmedPlan: requestUrl.searchParams.get("confirmedPlan"),
      todosJson: requestUrl.searchParams.get("todosJson"),
      limit: safeLimit,
    }));
    return true;
  }

  if (requestUrl.pathname === "/plugins/native-adapter/engineering-write-execution/evidence") {
    const safeLimit = clampLedgerLimit(parseLimit(requestUrl.searchParams));
    const taskId = requestUrl.searchParams.get("taskId") ?? null;
    const ledgerLimit = taskId ? 100 : safeLimit;
    sendJson(res, 200, buildNativeEngineeringWriteExecutionEvidence({
      filesystemChanges: executor.listFilesystemChangeRecords({ limit: ledgerLimit }),
      tasks: state.tasks,
      taskId,
      limit: safeLimit,
    }));
    return true;
  }

  if (requestUrl.pathname === "/filesystem/changes") {
    const safeLimit = clampLedgerLimit(parseLimit(requestUrl.searchParams));
    const items = executor.listFilesystemChangeRecords({ limit: safeLimit });
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: executor.serialiseFilesystemChangeSummary(executor.buildFilesystemChangeSummary()),
    });
    return true;
  }

  if (requestUrl.pathname === "/filesystem/changes/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: executor.serialiseFilesystemChangeSummary(executor.buildFilesystemChangeSummary()),
    });
    return true;
  }

  if (requestUrl.pathname === "/filesystem/reads") {
    const safeLimit = clampLedgerLimit(parseLimit(requestUrl.searchParams));
    const items = executor.listFilesystemReadRecords({ limit: safeLimit });
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: executor.serialiseFilesystemReadSummary(executor.buildFilesystemReadSummary()),
    });
    return true;
  }

  if (requestUrl.pathname === "/filesystem/reads/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: executor.serialiseFilesystemReadSummary(executor.buildFilesystemReadSummary()),
    });
    return true;
  }

  return false;
}
