const EDIT_PROPOSAL_CAPABILITY_ID = "act.openclaw.engineering_tool.edit_proposal";
const WRITE_PROPOSAL_CAPABILITY_ID = "act.openclaw.engineering_tool.write_proposal";

function requireBuilder(builder, name) {
  if (typeof builder !== "function") {
    throw new Error(`${name} is not configured.`);
  }
  return builder;
}

export function createEngineeringProposalCapabilityHandlers({
  buildNativeEngineeringEditProposal,
  buildNativeEngineeringWriteProposal,
} = {}) {
  function callBackend(capability, request) {
    const params = request.params ?? {};
    if (capability.id === EDIT_PROPOSAL_CAPABILITY_ID) {
      return {
        handled: true,
        result: requireBuilder(
          buildNativeEngineeringEditProposal,
          "buildNativeEngineeringEditProposal",
        )({
          workspacePath: params.workspacePath,
          relativePath: params.relativePath ?? params.path,
          oldString: params.oldString ?? params.search,
          newString: params.newString ?? params.replacement,
          contextLines: params.contextLines,
          maxOutputChars: params.maxOutputChars,
          maxFileSizeBytes: params.maxFileSizeBytes,
        }),
      };
    }
    if (capability.id === WRITE_PROPOSAL_CAPABILITY_ID) {
      return {
        handled: true,
        result: requireBuilder(
          buildNativeEngineeringWriteProposal,
          "buildNativeEngineeringWriteProposal",
        )({
          workspacePath: params.workspacePath,
          relativePath: params.relativePath ?? params.path,
          content: params.content,
          contentBase64: params.contentBase64,
          overwrite: params.overwrite,
          contextLines: params.contextLines,
          maxContentBytes: params.maxContentBytes,
          maxExistingFileBytes: params.maxExistingFileBytes,
        }),
      };
    }
    return {
      handled: false,
      result: null,
    };
  }

  function summariseResult(capability, result) {
    if (capability.id === WRITE_PROPOSAL_CAPABILITY_ID) {
      return summariseWriteProposal(result);
    }
    if (capability.id !== EDIT_PROPOSAL_CAPABILITY_ID) return null;
    const summary = result?.summary ?? {};
    const target = result?.target ?? {};
    const governance = result?.governance ?? {};
    const deferredExecutionBoundaries = new Set(result?.deferredExecutionBoundaries ?? []);
    return {
      kind: "engineering.edit_proposal",
      ok: result?.ok === true,
      blocked: result?.blocked === true,
      relativePath: target.relativePath ?? null,
      originalSha256: target.originalSha256 ?? null,
      proposedSha256: target.proposedSha256 ?? null,
      editCount: summary.editCount ?? 0,
      replacementsAvailable: summary.replacementsAvailable ?? 0,
      changedAtLine: summary.changedAtLine ?? null,
      previewLineCount: summary.previewLineCount ?? 0,
      previewTruncated: summary.previewTruncated === true,
      requiresApprovalBeforeApply: governance.requiresApprovalBeforeApply === true,
      noMutation: governance.canMutate === false
        && governance.canApplyPatch === false,
      noTaskCreation: governance.createsTask === false,
      noProviderEgress: deferredExecutionBoundaries.has("no provider call"),
    };
  }

  return { callBackend, summariseResult };
}

function summariseWriteProposal(result) {
  const summary = result?.summary ?? {};
  const target = result?.target ?? {};
  const governance = result?.governance ?? {};
  const deferredExecutionBoundaries = new Set(result?.deferredExecutionBoundaries ?? []);
  return {
    kind: "engineering.write_proposal",
    ok: result?.ok === true,
    blocked: result?.blocked === true,
    relativePath: target.relativePath ?? null,
    existingSha256: target.existingSha256 ?? null,
    proposedSha256: target.proposedSha256 ?? null,
    proposalKind: summary.proposalKind ?? null,
    targetExists: summary.targetExists === true,
    overwriteRequested: summary.overwriteRequested === true,
    proposedBytes: summary.proposedBytes ?? 0,
    previewLineCount: summary.previewLineCount ?? 0,
    previewTruncated: summary.previewTruncated === true,
    requiresApprovalBeforeWrite: governance.requiresApprovalBeforeWrite === true,
    noMutation: governance.canMutate === false
      && governance.canWriteFile === false
      && governance.canOverwriteFile === false,
    noTaskCreation: governance.createsTask === false,
    noProviderEgress: deferredExecutionBoundaries.has("no provider call"),
  };
}
