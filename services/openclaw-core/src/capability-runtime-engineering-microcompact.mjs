import { buildNativeEngineeringMicrocompactEvidence } from "./native-engineering-microcompact-evidence-builders.mjs";
import { buildNativeEngineeringMicrocompactProjection } from "./native-engineering-microcompact-projection.mjs";
import { buildNativeEngineeringRecoveryEvidence } from "./native-engineering-recovery-evidence-builders.mjs";
import { buildNativeEngineeringVerificationEvidence } from "./native-engineering-verification-evidence-builders.mjs";

const EVIDENCE_CAPABILITY_ID = "sense.openclaw.engineering_context.microcompact_evidence";
const PROJECTION_CAPABILITY_ID = "act.openclaw.engineering_context.microcompact_projection";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const LEDGER_INVOCATION_LIMIT = 100;

function normaliseLimit(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, MAX_LIMIT)
    : DEFAULT_LIMIT;
}

export function createEngineeringMicrocompactCapabilityHandlers({
  listCommandTranscriptRecords = () => [],
  listCapabilityInvocations = () => [],
  tasks = new Map(),
  publishEvent = async () => {},
} = {}) {
  function buildEvidence(request) {
    const params = request.params ?? {};
    const limit = normaliseLimit(params.limit);
    const transcriptRecords = listCommandTranscriptRecords({ limit });
    const capabilityInvocations = listCapabilityInvocations({
      limit: LEDGER_INVOCATION_LIMIT,
      capabilityId: "act.system.command.execute",
    });
    const verificationEvidence = buildNativeEngineeringVerificationEvidence({
      transcriptRecords: Array.isArray(transcriptRecords) ? transcriptRecords : [],
      capabilityInvocations: Array.isArray(capabilityInvocations) ? capabilityInvocations : [],
      tasks,
      limit,
      maxOutputChars: params.maxOutputChars,
    });
    const recoveryEvidence = buildNativeEngineeringRecoveryEvidence({
      verificationEvidence,
      tasks,
      limit,
    });
    return buildNativeEngineeringMicrocompactEvidence({
      transcriptRecords: Array.isArray(transcriptRecords) ? transcriptRecords : [],
      verificationEvidence,
      recoveryEvidence,
      tasks,
      limit: params.limit,
      thresholdChars: params.thresholdChars,
      protectRecentItems: params.protectRecentItems,
    });
  }

  async function buildProjection(request) {
    const params = request.params ?? {};
    const projection = buildNativeEngineeringMicrocompactProjection({
      messages: params.messages,
      thresholdChars: params.thresholdChars,
      protectRecentAssistantTurns: params.protectRecentAssistantTurns,
    });
    const auditResult = await publishEvent(
      "native_engineering.microcompact_projection_built",
      projection.auditEvidence,
    );
    if (auditResult?.ok === false) {
      throw new Error("Engineering context audit is unavailable.");
    }
    return projection;
  }

  async function callBackend(capability, request) {
    if (capability.id === EVIDENCE_CAPABILITY_ID) {
      return { handled: true, result: buildEvidence(request) };
    }
    if (capability.id === PROJECTION_CAPABILITY_ID) {
      return { handled: true, result: await buildProjection(request) };
    }
    return { handled: false, result: null };
  }

  function summariseResult(capability, result) {
    if (capability.id === EVIDENCE_CAPABILITY_ID) {
      const summary = result?.summary ?? {};
      const governance = result?.governance ?? {};
      const bounds = result?.bounds ?? {};
      return {
        kind: "engineering.microcompact_evidence",
        ok: result?.ok === true,
        totalItems: summary.totalItems ?? 0,
        compactableItems: summary.compactableItems ?? 0,
        protectedItems: summary.protectedItems ?? 0,
        reclaimedChars: summary.reclaimedChars ?? 0,
        noRawOutputText: bounds.noRawOutputText === true,
        noRuntimeMessageMutation: governance.canMutateRuntimeMessages === false
          && bounds.noRuntimeMessageMutation === true,
        noPersistedLogMutation: governance.canMutatePersistedLogs === false
          && bounds.noPersistedLogMutation === true,
        noProviderEgress: governance.canCallProvider === false,
      };
    }
    if (capability.id === PROJECTION_CAPABILITY_ID) {
      const summary = result?.summary ?? {};
      const governance = result?.governance ?? {};
      return {
        kind: "engineering.microcompact_projection",
        ok: result?.ok === true,
        changed: summary.changed === true,
        totalMessages: summary.totalMessages ?? 0,
        compactedMessages: summary.compactedMessages ?? 0,
        compactedBlocks: summary.compactedBlocks ?? 0,
        protectedEvidenceMessages: summary.protectedEvidenceMessages ?? 0,
        reclaimedChars: summary.reclaimedChars ?? 0,
        noInputMutation: governance.mutatesInputMessages === false,
        noPersistedMutation: governance.mutatesPersistedLogs === false
          && governance.mutatesTaskState === false,
        noProviderEgress: governance.callsProvider === false,
      };
    }
    return null;
  }

  function validateRequest(capability, request) {
    if (capability.id !== PROJECTION_CAPABILITY_ID) {
      return null;
    }
    if (!Array.isArray(request.params?.messages)) {
      return "Microcompact projection requires messages[].";
    }
    return null;
  }

  return { callBackend, summariseResult, validateRequest };
}
