export declare const WORK_VIEW_INPUT_MAX_CHARS: 2000;
export declare const WORK_VIEW_INPUT_EVIDENCE_REGISTRY: "openclaw-write-only-input-evidence-v0";

export type WorkViewInputEvidence = {
  registry: "openclaw-write-only-input-evidence-v0";
  charCount: number;
  byteLength: number;
  maxChars: 2000;
  truncated: boolean;
  textExposed: false;
  persisted: boolean;
};

export declare function buildWriteOnlyInputEvidence(
  value: unknown,
  options?: { persisted?: boolean },
): { text: string; evidence: WorkViewInputEvidence };
export declare function redactWriteOnlyInputParams(params: unknown): Record<string, unknown>;
export declare function redactWriteOnlyInputActionTree<T>(value: T): T;
export declare function hasRedactedWriteOnlyInputAction(value: unknown): boolean;
