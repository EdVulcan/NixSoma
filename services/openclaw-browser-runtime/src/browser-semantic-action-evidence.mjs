export function projectBrowserSemanticActionEvidence(effect) {
  if (!effect || typeof effect !== "object") return null;
  return {
    registry: typeof effect.registry === "string" ? effect.registry.slice(0, 80) : null,
    operation: ["click", "type"].includes(effect.operation) ? effect.operation : null,
    status: effect.status === "executed" ? "executed" : "unknown",
    frame: typeof effect.frame?.sha256 === "string" && Number.isInteger(effect.frame?.sequence)
      ? {
          sha256: effect.frame.sha256,
          sequence: effect.frame.sequence,
        }
      : null,
    sensitivePayloadRetained: false,
    targetAuthorityRetained: false,
    persisted: false,
  };
}
