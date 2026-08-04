import { createAiWorkspaceAssessment } from "./ai-workspace-assessment.mjs";
import { createAiWorkspaceOcrAssessment } from "./ai-workspace-ocr-assessment.mjs";
import { createAiWorkspaceOcrClick } from "./ai-workspace-ocr-click.mjs";
import { createAiWorkspaceOcrFocusType } from "./ai-workspace-ocr-focus-type.mjs";
import { createAiWorkspaceOcrType } from "./ai-workspace-ocr-type.mjs";
import { createAiWorkspaceRunCoordinator } from "./ai-workspace-run-coordinator.mjs";
import { createAiWorkspaceSingleStep } from "./ai-workspace-single-step.mjs";
import { createStandingProviderAdvisory } from "./standing-provider-advisory.mjs";

export function createAiWorkspaceRuntimes({
  state,
  fetchJson,
  postJson,
  sessionManagerUrl,
  screenSenseUrl,
  screenActUrl,
  systemSenseUrl,
  publishAuditEvent,
  persistState,
  getTaskById,
  createStandingProviderAdvisoryImpl = createStandingProviderAdvisory,
  createAiWorkspaceAssessmentImpl = createAiWorkspaceAssessment,
  createAiWorkspaceOcrAssessmentImpl = createAiWorkspaceOcrAssessment,
  createAiWorkspaceOcrClickImpl = createAiWorkspaceOcrClick,
  createAiWorkspaceOcrFocusTypeImpl = createAiWorkspaceOcrFocusType,
  createAiWorkspaceOcrTypeImpl = createAiWorkspaceOcrType,
  createAiWorkspaceSingleStepImpl = createAiWorkspaceSingleStep,
  createAiWorkspaceRunCoordinatorImpl = createAiWorkspaceRunCoordinator,
} = {}) {
  const standingProviderAdvisory = createStandingProviderAdvisoryImpl({
    state: state.standingProviderAdvisoryState,
    fetchJson,
    systemSenseUrl,
    publishAuditEvent,
    persistState,
  });
  const singleStepOwner = createAiWorkspaceSingleStepImpl({
    standingAdvisory: standingProviderAdvisory,
    fetchJson,
    postJson,
    sessionManagerUrl,
    screenSenseUrl,
    screenActUrl,
    publishAuditEvent,
    getTaskById,
  });
  const assessmentOwner = createAiWorkspaceAssessmentImpl({
    standingAdvisory: standingProviderAdvisory,
    fetchJson,
    sessionManagerUrl,
    screenSenseUrl,
    publishAuditEvent,
    getTaskById,
  });
  const ocrAssessmentOwner = createAiWorkspaceOcrAssessmentImpl({
    standingAdvisory: standingProviderAdvisory,
    fetchJson,
    sessionManagerUrl,
    publishAuditEvent,
    getTaskById,
  });
  const ocrClickOwner = createAiWorkspaceOcrClickImpl({
    standingAdvisory: standingProviderAdvisory,
    fetchJson,
    postJson,
    sessionManagerUrl,
    screenActUrl,
    publishAuditEvent,
    getTaskById,
  });
  const ocrTypeOwner = createAiWorkspaceOcrTypeImpl({
    standingAdvisory: standingProviderAdvisory,
    fetchJson,
    postJson,
    sessionManagerUrl,
    screenActUrl,
    publishAuditEvent,
    getTaskById,
  });
  const ocrFocusTypeOwner = createAiWorkspaceOcrFocusTypeImpl({
    standingAdvisory: standingProviderAdvisory,
    fetchJson,
    postJson,
    sessionManagerUrl,
    screenActUrl,
    publishAuditEvent,
    getTaskById,
  });
  const runs = createAiWorkspaceRunCoordinatorImpl({
    singleStep: singleStepOwner,
    assessment: assessmentOwner,
    ocrAssessment: ocrAssessmentOwner,
    ocrClick: ocrClickOwner,
    ocrType: ocrTypeOwner,
    ocrFocusType: ocrFocusTypeOwner,
    publishAuditEvent,
  });
  return {
    standingProviderAdvisory,
    assessment: runs.assessment,
    ocrAssessment: runs.ocrAssessment,
    ocrClick: runs.ocrClick,
    ocrType: runs.ocrType,
    ocrFocusType: runs.ocrFocusType,
    semanticSubmit: runs.semanticSubmit,
    semanticFormWorkflow: runs.semanticFormWorkflow,
    singleStep: runs.singleStep,
    boundedRun: runs.boundedRun,
    reviewedCycle: runs.reviewedCycle,
  };
}
