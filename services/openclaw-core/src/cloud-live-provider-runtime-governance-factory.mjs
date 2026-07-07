export const CLOUD_PROVIDER_NO_EGRESS_GOVERNANCE = {
  callsCloudModel: false,
  transmitsExternally: false,
  liveProviderCallEnabled: false,
  providerSdkLoaded: false,
  providerCredentialRead: false,
  credentialValueRead: false,
  endpointContacted: false,
  networkEgress: false,
};

export const CREDENTIAL_VALUE_DENIED_GOVERNANCE = {
  createsTask: false,
  createsApproval: false,
  credentialValueIncluded: false,
  credentialValueRead: false,
  credentialValueExposed: false,
  providerCredentialRead: false,
  endpointNetworkEgressAuthorized: false,
  endpointNetworkEgressDenied: true,
  endpointContacted: false,
  networkEgress: false,
  transmitsExternally: false,
  liveProviderCallEnabled: false,
  providerResponseCreated: false,
  rollbackExecuted: false,
  rollbackCommandCreated: false,
  hostMutation: false,
  launchAuthorized: false,
  launchExecuted: false,
};

export const CREDENTIAL_LOCAL_READ_RESULT_ENVELOPE_GOVERNANCE = {
  ...CREDENTIAL_VALUE_DENIED_GOVERNANCE,
  credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated: false,
};

export function definePhaseGovernance(phase, defaults = {}, sharedDefaults = {}) {
  return function phaseGovernance(extra = {}) {
    return {
      phase,
      ...defaults,
      ...sharedDefaults,
      ...extra,
    };
  };
}
