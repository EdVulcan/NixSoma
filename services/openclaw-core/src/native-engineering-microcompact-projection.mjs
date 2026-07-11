export const NATIVE_ENGINEERING_MICROCOMPACT_PROJECTION_REGISTRY =
  "openclaw-native-engineering-microcompact-projection-v0";

const DEFAULT_THRESHOLD_CHARS = 1_000;
const DEFAULT_PROTECT_RECENT_ASSISTANT_TURNS = 3;
const MAX_MESSAGES = 100;
const MAX_INPUT_CHARS = 500_000;
const MAX_THRESHOLD_CHARS = 100_000;
const MAX_PROTECTED_TURNS = 20;

function boundedInteger(value, fallback, { min, max }) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) ? Math.max(min, Math.min(parsed, max)) : fallback;
}

function textBlocks(message) {
  return Array.isArray(message?.content)
    ? message.content.filter((block) => block?.type === "text" && typeof block.text === "string")
    : [];
}

function messageTextChars(message) {
  return textBlocks(message).reduce((total, block) => total + block.text.length, 0);
}

function isProtectedEvidence(message) {
  const evidenceKind = message?.evidenceKind ?? message?.metadata?.evidenceKind ?? null;
  return ["verification", "recovery", "verification_evidence", "recovery_evidence"].includes(evidenceKind)
    || ["cc_verify", "verification", "recovery"].includes(message?.toolName ?? message?.name ?? "");
}

function findProtectedBoundary(messages, protectRecentAssistantTurns) {
  let assistantTurns = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      assistantTurns += 1;
      if (assistantTurns > protectRecentAssistantTurns) return index;
    }
  }
  return -1;
}

function validateMessages(messages) {
  if (!Array.isArray(messages)) throw new Error("Microcompact projection requires messages[].");
  if (messages.length > MAX_MESSAGES) throw new Error(`Microcompact projection accepts at most ${MAX_MESSAGES} messages.`);
  let inputChars = 0;
  for (const message of messages) {
    if (!message || typeof message !== "object" || Array.isArray(message) || typeof message.role !== "string") {
      throw new Error("Each microcompact message must be an object with a role.");
    }
    inputChars += messageTextChars(message);
    if (inputChars > MAX_INPUT_CHARS) {
      throw new Error(`Microcompact projection text exceeds ${MAX_INPUT_CHARS} characters.`);
    }
  }
  return inputChars;
}

export function buildNativeEngineeringMicrocompactProjection({
  messages,
  thresholdChars = DEFAULT_THRESHOLD_CHARS,
  protectRecentAssistantTurns = DEFAULT_PROTECT_RECENT_ASSISTANT_TURNS,
} = {}) {
  const inputChars = validateMessages(messages);
  const safeThresholdChars = boundedInteger(thresholdChars, DEFAULT_THRESHOLD_CHARS, {
    min: 1,
    max: MAX_THRESHOLD_CHARS,
  });
  const safeProtectedTurns = boundedInteger(
    protectRecentAssistantTurns,
    DEFAULT_PROTECT_RECENT_ASSISTANT_TURNS,
    { min: 0, max: MAX_PROTECTED_TURNS },
  );
  const protectedBoundary = findProtectedBoundary(messages, safeProtectedTurns);
  let compactedBlocks = 0;
  let compactedMessages = 0;
  let reclaimedChars = 0;
  let protectedEvidenceMessages = 0;

  const projectedMessages = messages.map((message, index) => {
    const outsideRecentWindow = protectedBoundary >= 0 && index <= protectedBoundary;
    const evidenceProtected = isProtectedEvidence(message);
    if (evidenceProtected) protectedEvidenceMessages += 1;
    if (message.role !== "toolResult" || !outsideRecentWindow || evidenceProtected) return message;

    let messageChanged = false;
    const content = Array.isArray(message.content)
      ? message.content.map((block) => {
          if (block?.type !== "text" || typeof block.text !== "string" || block.text.length <= safeThresholdChars) {
            return block;
          }
          const toolName = message.toolName ?? message.name ?? "unknown_tool";
          const replacement = `[Microcompact: historical ${toolName} result, ${block.text.length} chars elided; structural metadata retained.]`;
          compactedBlocks += 1;
          reclaimedChars += Math.max(0, block.text.length - replacement.length);
          messageChanged = true;
          return { ...block, text: replacement };
        })
      : message.content;
    if (!messageChanged) return message;
    compactedMessages += 1;
    return { ...message, content };
  });
  const outputChars = projectedMessages.reduce((total, message) => total + messageTextChars(message), 0);
  const generatedAt = new Date().toISOString();

  return {
    ok: true,
    registry: NATIVE_ENGINEERING_MICROCOMPACT_PROJECTION_REGISTRY,
    mode: "bounded_in_memory_context_projection",
    generatedAt,
    identityLevel: "Level 1: stable user-space control plane",
    capability: {
      id: "act.openclaw.engineering_context.microcompact_projection",
      sourceToolName: "microcompact",
      risk: "low",
      approvalRequired: false,
    },
    messages: projectedMessages,
    summary: {
      changed: compactedBlocks > 0,
      totalMessages: messages.length,
      compactedMessages,
      compactedBlocks,
      protectedEvidenceMessages,
      inputChars,
      outputChars,
      reclaimedChars,
    },
    bounds: {
      maxMessages: MAX_MESSAGES,
      maxInputChars: MAX_INPUT_CHARS,
      thresholdChars: safeThresholdChars,
      protectRecentAssistantTurns: safeProtectedTurns,
    },
    governance: {
      transformsRequestCopyOnly: true,
      mutatesInputMessages: false,
      mutatesPersistedLogs: false,
      mutatesTaskState: false,
      callsProvider: false,
      createsTask: false,
      createsApproval: false,
    },
    auditEvidence: {
      operation: "microcompact_context_projection",
      generatedAt,
      inputContentRecorded: false,
      outputContentRecorded: false,
      summary: {
        totalMessages: messages.length,
        compactedMessages,
        compactedBlocks,
        reclaimedChars,
      },
    },
  };
}
