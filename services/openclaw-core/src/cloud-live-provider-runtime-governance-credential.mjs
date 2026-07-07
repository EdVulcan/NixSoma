import { CREDENTIAL_VALUE_DENIED_GOVERNANCE, definePhaseGovernance } from "./cloud-live-provider-runtime-governance-factory.mjs";

export const phase65Governance = definePhaseGovernance("phase-65", {
  credentialValueAuthorizationRouteOnly: true,
  requiresApprovedDeferredEgressExecutionEvidence: true,
  credentialValueAuthorizationTaskCreated: false,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase66Governance = definePhaseGovernance("phase-66", {
  credentialValueAuthorizationTaskShellOnly: true,
  requiresCredentialValueAuthorizationRouteEvidence: true,
  credentialValueAuthorizationTaskCreated: false,
  credentialValueAuthorizationTaskApproved: false,
  credentialValueAuthorizationDeferred: true,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase67Governance = definePhaseGovernance("phase-67", {
  approvedDeferredEvidenceOnly: true,
  requiresCredentialValueAuthorizationTaskShellEvidence: true,
  credentialValueAuthorizationTaskCreated: true,
  credentialValueAuthorizationTaskApproved: true,
  credentialValueAuthorizationDeferred: true,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase68Governance = definePhaseGovernance("phase-68", {
  credentialValueReadinessPreflightOnly: true,
  requiresCredentialValueAuthorizationApprovedDeferredEvidence: true,
  credentialValueReadinessPreflightRecorded: false,
  credentialValueAuthorizationTaskCreated: true,
  credentialValueAuthorizationTaskApproved: true,
  credentialValueAuthorizationDeferred: true,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase69Governance = definePhaseGovernance("phase-69", {
  credentialValueReadTaskShellOnly: true,
  requiresCredentialValueReadinessPreflightEvidence: true,
  credentialValueReadTaskCreated: false,
  credentialValueReadTaskApproved: false,
  credentialValueReadDeferred: true,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase70Governance = definePhaseGovernance("phase-70", {
  approvedDeferredEvidenceOnly: true,
  requiresCredentialValueReadTaskShellEvidence: true,
  credentialValueReadTaskCreated: true,
  credentialValueReadTaskApproved: true,
  credentialValueReadDeferred: true,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase71Governance = definePhaseGovernance("phase-71", {
  credentialValueAccessAuthorizationRouteOnly: true,
  requiresCredentialValueReadApprovedDeferredEvidence: true,
  credentialValueAccessAuthorizationTaskCreated: false,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase72Governance = definePhaseGovernance("phase-72", {
  credentialValueAccessAuthorizationTaskShellOnly: true,
  requiresCredentialValueAccessAuthorizationRouteEvidence: true,
  credentialValueAccessAuthorizationTaskCreated: false,
  credentialValueAccessAuthorizationTaskApproved: false,
  credentialValueAccessAuthorizationDeferred: true,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase73Governance = definePhaseGovernance("phase-73", {
  approvedDeferredEvidenceOnly: true,
  requiresCredentialValueAccessAuthorizationTaskShellEvidence: true,
  credentialValueAccessAuthorizationTaskCreated: true,
  credentialValueAccessAuthorizationTaskApproved: true,
  credentialValueAccessAuthorizationDeferred: true,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase74Governance = definePhaseGovernance("phase-74", {
  credentialValueFinalReadinessPreflightOnly: true,
  requiresCredentialValueAccessAuthorizationApprovedDeferredEvidence: true,
  credentialValueFinalReadinessPreflightRecorded: false,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase75Governance = definePhaseGovernance("phase-75", {
  credentialValueAccessAuthorizationDecisionRouteOnly: true,
  requiresCredentialValueFinalReadinessPreflightEvidence: true,
  credentialValueAccessAuthorizationDecisionTaskCreated: false,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase76Governance = definePhaseGovernance("phase-76", {
  credentialValueAccessAuthorizationDecisionTaskShellOnly: true,
  requiresCredentialValueAccessAuthorizationDecisionRouteEvidence: true,
  credentialValueAccessAuthorizationDecisionTaskCreated: false,
  credentialValueAccessAuthorizationDecisionTaskApproved: false,
  credentialValueAccessAuthorizationDecisionDeferred: true,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase77Governance = definePhaseGovernance("phase-77", {
  approvedDeferredEvidenceOnly: true,
  requiresCredentialValueAccessAuthorizationDecisionTaskShellEvidence: true,
  credentialValueAccessAuthorizationDecisionTaskCreated: true,
  credentialValueAccessAuthorizationDecisionTaskApproved: true,
  credentialValueAccessAuthorizationDecisionDeferred: true,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase78Governance = definePhaseGovernance("phase-78", {
  credentialValueAccessAuthorizedLocalProofOnly: true,
  requiresCredentialValueAccessAuthorizationDecisionApprovedDeferredEvidence: true,
  credentialValueAccessAuthorizedLocalProofRecorded: false,
  credentialValueAccessAuthorized: false,
  credentialValueAccessDenied: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase79Governance = definePhaseGovernance("phase-79", {
  credentialValueLocalReadRouteOnly: true,
  requiresCredentialValueAccessAuthorizedLocalProofEvidence: true,
  credentialValueLocalReadTaskCreated: false,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase80Governance = definePhaseGovernance("phase-80", {
  credentialValueLocalReadTaskShellOnly: true,
  requiresCredentialValueLocalReadRouteEvidence: true,
  credentialValueLocalReadTaskCreated: false,
  credentialValueLocalReadTaskApproved: false,
  credentialValueLocalReadDeferred: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase81Governance = definePhaseGovernance("phase-81", {
  approvedDeferredEvidenceOnly: true,
  requiresCredentialValueLocalReadTaskShellEvidence: true,
  credentialValueLocalReadTaskCreated: true,
  credentialValueLocalReadTaskApproved: true,
  credentialValueLocalReadDeferred: true,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);

export const phase82Governance = definePhaseGovernance("phase-82", {
  credentialValueLocalReadFinalReadinessPreflightOnly: true,
  requiresCredentialValueLocalReadApprovedDeferredEvidence: true,
  credentialValueLocalReadFinalReadinessPreflightRecorded: false,
}, CREDENTIAL_VALUE_DENIED_GOVERNANCE);
