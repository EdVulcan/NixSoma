import { createAiWorkspaceAssessment } from "./ai-workspace-assessment.mjs";
import { createAiWorkspaceOcrAssessment } from "./ai-workspace-ocr-assessment.mjs";
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
  const runs = createAiWorkspaceRunCoordinatorImpl({
    singleStep: singleStepOwner,
    assessment: assessmentOwner,
    ocrAssessment: ocrAssessmentOwner,
    publishAuditEvent,
  });
  return {
    standingProviderAdvisory,
    assessment: runs.assessment,
    ocrAssessment: runs.ocrAssessment,
    singleStep: runs.singleStep,
    boundedRun: runs.boundedRun,
  };
}
