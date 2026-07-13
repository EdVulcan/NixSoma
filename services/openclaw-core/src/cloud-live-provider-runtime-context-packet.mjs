import { createHash } from "node:crypto";
import { buildNativeEngineeringContextPacket } from "./native-engineering-context-packet.mjs";
import { buildNativeEngineeringRecoveryEvidence } from "./native-engineering-recovery-evidence-builders.mjs";
import { buildNativeEngineeringVerificationEvidence } from "./native-engineering-verification-evidence-builders.mjs";
import {
  CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
  buildCloudLiveProviderEngineeringRecommendationInstruction,
} from "./cloud-live-provider-runtime-response-contract.mjs";

export const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-context-packet-v0";
export const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_EVIDENCE =
  Symbol("openclaw-live-provider-context-packet-evidence");

const DEFAULT_TRANSCRIPT_LIMIT = 6;
const MAX_TRANSCRIPT_LIMIT = 8;
const DEFAULT_OUTPUT_CHARS = 1_800;
const MAX_OUTPUT_CHARS = 3_000;
const MAX_INSTRUCTION_CHARS = 2_000;
const MAX_PROVIDER_CONTENT_CHARS = 7_600;

function boundedPositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function boundedText(value, maxChars) {
  return typeof value === "string" ? value.trim().slice(0, maxChars) : "";
}

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function redactInlineText(value) {
  return value
    .replace(/\b(password|passwd|secret|token|api[_-]?key|credential)\s*[:=]\s*([^\s,;]+)/giu, "$1=<redacted>")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gu, "Bearer <redacted>")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/gu, "<redacted-key>");
}

function packetMessageSource(message) {
  return message?.message && typeof message.message === "object"
    ? message.message
    : message;
}

function packetMessageText(message) {
  const source = packetMessageSource(message);
  const text = Array.isArray(source?.content)
    ? source.content
      .filter((block) => block?.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("\n")
    : "";
  if (!text) return "";
  const label = [source.role, source.toolName, source.contextKind, source.evidenceKind]
    .filter((value) => typeof value === "string" && value.length > 0)
    .join("/");
  const command = boundedText(source.commandShape?.command, 400);
  const commandLine = command ? `command: ${redactInlineText(command)}` : "";
  return [label ? `[${label}]` : "", commandLine, text].filter(Boolean).join("\n");
}

function compactPacketEvidence(packet, {
  taskId,
  contextText,
  providerMessageChars,
  contextTruncated,
  responseContract,
} = {}) {
  return {
    registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CONTEXT_PACKET_REGISTRY,
    sourceRegistry: packet.registry,
    taskId,
    responseContract,
    sourceTranscriptRecords: packet.summary?.sourceTranscriptRecords ?? 0,
    messageCount: packet.summary?.messageCount ?? 0,
    redactions: packet.summary?.redactions ?? 0,
    truncatedOutputs: packet.summary?.truncatedOutputs ?? 0,
    compactedMessages: packet.summary?.compactedMessages ?? 0,
    reclaimedChars: packet.summary?.reclaimedChars ?? 0,
    contextContentHash: hashText(contextText),
    providerMessageChars,
    contextTruncated,
    contextContentIncluded: false,
    requestEnvelopeMaterialized: true,
  };
}

export function materialiseCloudLiveProviderContextPacketExecution({
  task,
  liveProviderExecution,
  transcriptRecords = [],
  capabilityInvocations = [],
  tasks = new Map(),
} = {}) {
  const contextRequest = liveProviderExecution?.contextPacket;
  if (!contextRequest || contextRequest.requested !== true) {
    return {
      ok: true,
      liveProviderExecution,
      evidence: null,
    };
  }

  const taskId = task?.id ?? null;
  const requestedTaskId = typeof contextRequest.taskId === "string" && contextRequest.taskId.trim()
    ? contextRequest.taskId.trim()
    : taskId;
  if (!taskId || requestedTaskId !== taskId) {
    return {
      ok: false,
      reason: "live_provider_context_task_mismatch",
    };
  }
  if (liveProviderExecution.requestEnvelope && typeof liveProviderExecution.requestEnvelope === "object") {
    return {
      ok: false,
      reason: "live_provider_context_request_envelope_conflict",
    };
  }

  const responseContract = contextRequest.responseContract === undefined
    ? CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT
    : contextRequest.responseContract;
  if (responseContract !== CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT) {
    return {
      ok: false,
      reason: "live_provider_context_response_contract_not_supported",
    };
  }

  const limit = boundedPositiveInteger(contextRequest.limit, DEFAULT_TRANSCRIPT_LIMIT, MAX_TRANSCRIPT_LIMIT);
  const maxOutputChars = boundedPositiveInteger(
    contextRequest.maxOutputChars,
    DEFAULT_OUTPUT_CHARS,
    MAX_OUTPUT_CHARS,
  );
  const verificationEvidence = buildNativeEngineeringVerificationEvidence({
    transcriptRecords,
    capabilityInvocations,
    tasks,
    taskId,
    limit,
    maxOutputChars,
  });
  const recoveryEvidence = buildNativeEngineeringRecoveryEvidence({
    verificationEvidence,
    tasks,
    taskId,
    limit,
  });
  const packet = buildNativeEngineeringContextPacket({
    transcriptRecords,
    tasks,
    verificationEvidence,
    recoveryEvidence,
    taskId,
    limit,
    maxOutputChars,
    thresholdChars: contextRequest.thresholdChars,
    protectRecentAssistantTurns: contextRequest.protectRecentAssistantTurns,
  });
  const fullContextText = packet.messages.map(packetMessageText).filter(Boolean).join("\n\n");
  const requestedInstruction = boundedText(
    contextRequest.instruction,
    MAX_INSTRUCTION_CHARS,
  ) || "Review this bounded local engineering context and provide a concise next-step recommendation. Do not propose uncontrolled execution.";
  const responseContractInstruction = buildCloudLiveProviderEngineeringRecommendationInstruction();
  const instruction = [
    boundedText(
      requestedInstruction,
      Math.max(0, MAX_INSTRUCTION_CHARS - responseContractInstruction.length - 1),
    ),
    responseContractInstruction,
  ].filter(Boolean).join(" ");
  const header = "OpenClaw local engineering context, explicitly included for this one approved provider call:";
  const truncationMarker = "\n[local context truncated to the provider request bound]";
  const contextBudget = Math.max(
    512,
    MAX_PROVIDER_CONTENT_CHARS - header.length - instruction.length - truncationMarker.length - 32,
  );
  const contextText = fullContextText.slice(0, contextBudget);
  const contextTruncated = contextText.length < fullContextText.length;
  const content = [
    header,
    contextText || "(No bounded local command transcript records were available.)",
    contextTruncated ? truncationMarker : null,
    `Operator request: ${instruction}`,
  ].filter(Boolean).join("\n\n");
  const evidence = compactPacketEvidence(packet, {
    taskId,
    contextText: fullContextText,
    providerMessageChars: content.length,
    contextTruncated,
    responseContract,
  });
  const requestEnvelope = {
    messages: [{ role: "user", content }],
  };
  const model = boundedText(contextRequest.model, 120);
  if (model) requestEnvelope.model = model;

  return {
    ok: true,
    liveProviderExecution: {
      ...liveProviderExecution,
      contextPacket: {
        requested: true,
        taskId,
        responseContract,
      },
      responseContract,
      requestEnvelope,
    },
    evidence,
  };
}
