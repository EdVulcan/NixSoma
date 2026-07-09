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

