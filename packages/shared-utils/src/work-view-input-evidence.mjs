export const WORK_VIEW_INPUT_MAX_CHARS = 2_000;
export const WORK_VIEW_INPUT_EVIDENCE_REGISTRY = "openclaw-write-only-input-evidence-v0";

const INPUT_ACTION_KINDS = new Set(["keyboard.type", "browser.semantic_type"]);

export function buildWriteOnlyInputEvidence(value, { persisted = false } = {}) {
  const original = typeof value === "string" ? value : "";
  const text = original.slice(0, WORK_VIEW_INPUT_MAX_CHARS);
  return {
    text,
    evidence: {
      registry: WORK_VIEW_INPUT_EVIDENCE_REGISTRY,
      charCount: text.length,
      byteLength: Buffer.byteLength(text, "utf8"),
      maxChars: WORK_VIEW_INPUT_MAX_CHARS,
      truncated: original.length > WORK_VIEW_INPUT_MAX_CHARS,
      textExposed: false,
      persisted,
    },
  };
}

export function redactWriteOnlyInputParams(params) {
  const source = params && typeof params === "object" && !Array.isArray(params) ? params : {};
  const { text, ...rest } = source;
  if (typeof text !== "string") return { ...rest };
  return {
    ...rest,
    inputEvidence: buildWriteOnlyInputEvidence(text).evidence,
  };
}

export function redactWriteOnlyInputActionTree(value) {
  if (Array.isArray(value)) return value.map(redactWriteOnlyInputActionTree);
  if (!value || typeof value !== "object") return value;
  const projected = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactWriteOnlyInputActionTree(item)]),
  );
  if (INPUT_ACTION_KINDS.has(value.kind) && value.params && typeof value.params === "object") {
    projected.params = redactWriteOnlyInputParams(value.params);
  }
  return projected;
}

export function hasRedactedWriteOnlyInputAction(value) {
  if (Array.isArray(value)) return value.some(hasRedactedWriteOnlyInputAction);
  if (!value || typeof value !== "object") return false;
  if (INPUT_ACTION_KINDS.has(value.kind)
    && value.params?.inputEvidence?.registry === WORK_VIEW_INPUT_EVIDENCE_REGISTRY
    && typeof value.params?.text !== "string") {
    return true;
  }
  return Object.values(value).some(hasRedactedWriteOnlyInputAction);
}
