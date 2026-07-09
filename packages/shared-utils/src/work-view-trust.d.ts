export type TrustedWorkViewReadiness = "ready" | "prepared" | "warming_up" | "degraded";

export type TrustedWorkViewContract = {
  kind: "openclaw-trusted-session-work-view-contract";
  identityLevel: "level_2_trusted_session_work_view";
  identityLevelNumber: 2;
  identityPath: string[];
  readiness: TrustedWorkViewReadiness;
  trustedComponent: string;
  boundary: {
    workViewScope: "ai_owned_work_view_only";
    desktopWideCapture: false;
    rootRequired: false;
    hostMutation: false;
    providerEgress: false;
  };
  capabilities: {
    managesAiOwnedWorkView: boolean;
    observesAiOwnedWorkView: boolean;
    recordsCaptureProvenance: boolean;
    supportsRevealHide: boolean;
    supportsOperatorTakeover: boolean;
  };
  operatorGates: {
    prepare: string;
    reveal: string;
    hide: string;
    takeover: string;
  };
  captureProvenance: {
    source: string;
    strategy: string;
    browserRuntimeBacked: boolean;
    sessionId: string | null;
    activeUrl: string | null;
    capturedAt: string | null;
    visibleToObserver: boolean;
  };
  helperReadiness: {
    state: "ready" | "prepared_hidden" | "needs_prepare" | "degraded";
    reason: string;
    recommendedOperatorAction: string;
    recoveryEndpoint: string | null;
    approvalRequired: false;
    rootRequired: false;
    canRecoverWithoutRoot: true;
    observerVisible: true;
    availableOperatorActions: Array<{
      id: string;
      endpoint: string;
      approvalRequired: false;
    }>;
  };
  recoveryRecommendation: {
    action: string;
    endpoint: string | null;
    reason: string;
    approvalRequired: false;
    rootRequired: false;
    canRecoverWithoutRoot: true;
  };
  sidecarContract: {
    status: "drafted_not_started";
    identityLevel: "level_2_trusted_session_work_view";
    lifecycle: {
      processStarted: false;
      installRequired: false;
      rootRequired: false;
      systemDaemonRequired: false;
      approvalRequiredBeforeStart: true;
    };
    lifecycleProposal: {
      status: "proposal_ready";
      capabilityId: "plan.openclaw.work_view.trusted_sidecar_lifecycle";
      approvalGate: "required_before_process_start";
      executionStatus: "deferred";
      taskCreationDeferred: true;
      allowedTransitions: string[];
    };
    approvalTaskDraft: {
      status: "draft_ready";
      createsTaskNow: false;
      createsApprovalNow: false;
      approvalRequiredBeforeExecution: true;
      taskType: "work_view_trusted_sidecar_lifecycle";
      plannedCapabilityId: "act.openclaw.work_view.trusted_sidecar_lifecycle";
      executionStatus: "deferred";
      processStartEnabled: false;
      rootRequired: false;
      plannedPhases: string[];
    };
    responsibilities: {
      capture: string;
      action: string;
      recovery: string;
      observer: string;
    };
    forbidden: {
      desktopWideCapture: true;
      rootDaemon: true;
      hostMutation: true;
      providerEgress: true;
      credentialAccess: true;
      arbitraryEndpointExecution: true;
    };
    observerVisibility: {
      workViewState: string;
      screenState: string;
      phase3Readback: string;
    };
  };
  evidence: {
    sessionStatus: string;
    workViewStatus: string;
    visibility: string;
    mode: string;
    helperStatus: string;
    browserStatus: string;
    displayTarget: string;
  };
  deferred: {
    desktopWideCapture: true;
    rootSessionDaemon: true;
    hostMutation: true;
    graphicsStackNativeWorkspace: true;
  };
};

export function buildTrustedWorkViewContract(input?: Record<string, unknown>): TrustedWorkViewContract;
