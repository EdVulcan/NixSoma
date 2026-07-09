const VERIFICATION_CHECKS = new Set(["typecheck", "test", "lint", "verify"]);

function countTerm(termCounts, term) {
  return Number(termCounts?.[term] ?? 0);
}

function hasCheck(expectedChecks, check) {
  return Array.isArray(expectedChecks) && expectedChecks.includes(check);
}

function buildStandard({ id, title, category, expectation, satisfied, evidence, appliesTo, required = true }) {
  return {
    id,
    title,
    category,
    expectation,
    required,
    status: satisfied ? "satisfied" : "missing",
    satisfied,
    evidence,
    source: "derived_prompt_semantics",
    appliesTo,
  };
}

export function buildPromptWorkStandardsAssessment({
  expectedChecks = [],
  termCounts = {},
  files = [],
  scripts = [],
  contentExposed = false,
} = {}) {
  const verificationChecks = expectedChecks.filter((check) => VERIFICATION_CHECKS.has(check));
  const standards = [
    buildStandard({
      id: "plan_before_mutation",
      title: "Plan before mutation",
      category: "planning",
      expectation: "Engineering edits should carry plan-first intent before mutation.",
      satisfied: countTerm(termCounts, "plan") > 0,
      evidence: `plan_terms=${countTerm(termCounts, "plan")}`,
      appliesTo: ["edit_proposal", "write_proposal", "recovery_rerun"],
    }),
    buildStandard({
      id: "diff_preview_before_apply",
      title: "Diff preview before apply",
      category: "proposal",
      expectation: "Edit/write proposals should expose a bounded diff or mutation preview before approval.",
      satisfied: hasCheck(expectedChecks, "diff-preview"),
      evidence: "expectedChecks.diff-preview",
      appliesTo: ["edit_proposal", "workspace_patch_apply"],
    }),
    buildStandard({
      id: "explicit_approval_for_mutation",
      title: "Explicit approval for mutation",
      category: "governance",
      expectation: "Filesystem mutation should remain approval-gated.",
      satisfied: hasCheck(expectedChecks, "approval-required") || countTerm(termCounts, "approval") > 0,
      evidence: `approval_terms=${countTerm(termCounts, "approval")}`,
      appliesTo: ["workspace_text_write", "workspace_patch_apply", "recovery_rerun"],
    }),
    buildStandard({
      id: "filesystem_ledger_after_apply",
      title: "Filesystem ledger after apply",
      category: "audit",
      expectation: "Approved writes/patches should be recoverable through ledger evidence.",
      satisfied: hasCheck(expectedChecks, "filesystem-ledger"),
      evidence: "expectedChecks.filesystem-ledger",
      appliesTo: ["workspace_text_write", "workspace_patch_apply"],
    }),
    buildStandard({
      id: "patch_validation_for_edits",
      title: "Patch validation for edits",
      category: "validation",
      expectation: "Patch-style edits should carry exact-match validation before task creation.",
      satisfied: hasCheck(expectedChecks, "patch-validation"),
      evidence: "expectedChecks.patch-validation",
      appliesTo: ["edit_proposal", "workspace_patch_apply"],
    }),
    buildStandard({
      id: "verification_evidence_before_report",
      title: "Verification evidence before report",
      category: "validation",
      expectation: "Completion should cite verification checks instead of relying on prose-only claims.",
      satisfied: verificationChecks.length > 0,
      evidence: `verificationChecks=${verificationChecks.join(",") || "none"}`,
      appliesTo: ["verification_task", "task_completion", "observer_readback"],
    }),
    buildStandard({
      id: "prompt_content_not_product_authority",
      title: "Prompt content is not product authority",
      category: "boundary",
      expectation: "Prompt files may inform derived standards, but raw prompt bodies stay hidden and are not executed.",
      satisfied: contentExposed !== true,
      evidence: `contentExposed=${Boolean(contentExposed)}`,
      appliesTo: ["prompt_semantics", "observer_readback"],
    }),
  ];

  const required = standards.filter((standard) => standard.required);
  const satisfiedRequired = required.filter((standard) => standard.satisfied);
  const missingRequired = required.filter((standard) => !standard.satisfied);
  const totalPromptFiles = Array.isArray(files) ? files.length : 0;

  return {
    registry: "openclaw-engineering-work-standards-v0",
    mode: "observer-verifiable-work-standards-derived-from-prompt-semantics",
    status: missingRequired.length === 0 ? "ready_for_engineering_loop_guidance" : "needs_operator_review",
    sourceRegistry: "openclaw-native-prompt-semantics-v0",
    score: {
      required: required.length,
      satisfied: satisfiedRequired.length,
      missing: missingRequired.length,
      ratio: required.length > 0 ? Number((satisfiedRequired.length / required.length).toFixed(3)) : 1,
    },
    promptInputs: {
      filesObserved: totalPromptFiles,
      promptContentExposed: Boolean(contentExposed),
      scriptsObserved: Array.isArray(scripts) ? scripts.slice().sort() : [],
    },
    standards,
    missingRequiredStandards: missingRequired.map((standard) => standard.id),
    operatorContract: {
      proposalShouldCarryExpectedChecks: true,
      mutationRequiresApproval: true,
      completionShouldAttachVerificationEvidence: true,
      reportRequiresEvidence: true,
      promptWallEnforced: false,
    },
    governance: {
      canReadPromptMetadata: true,
      canReadPromptContentForSignals: true,
      exposesPromptContent: false,
      canExecutePromptCode: false,
      canCreateTask: false,
      canCreateApproval: false,
      canMutate: false,
      observerVisible: true,
    },
  };
}
