import {
  createConfirmPostRouteHandler,
  postRoute,
  serialisedApprovalField,
  serialisedTaskField,
} from "./cloud-live-provider-post-route-utils.mjs";

const taskFields = (extraFields) => ["sourceRegistry", ...extraFields, serialisedTaskField, serialisedApprovalField];
const preflightFields = ["status", "preflight", serialisedTaskField];

const LIVE_PROVIDER_TASK_POST_ROUTES = new Map([
  postRoute(
    "/cloud-consciousness/live-provider-runbook-tasks",
    "createCloudConsciousnessLiveProviderRunbookTask",
    taskFields(["routeReview", "authorizationReview"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-execution-plan-tasks",
    "createCloudConsciousnessLiveProviderExecutionPlanTask",
    taskFields(["routeReview", "transcriptSchema"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-runtime-adapter-tasks",
    "createCloudConsciousnessLiveProviderRuntimeAdapterTask",
    taskFields(["adapterPlan"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-runtime-implementation-tasks",
    "createCloudConsciousnessLiveProviderRuntimeImplementationTask",
    taskFields(["implementationPlan"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-runtime-adapter-implementation-tasks",
    "createCloudConsciousnessLiveProviderRuntimeAdapterImplementationTask",
    taskFields(["adapterImplementation"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-runtime-adapter-module-tasks",
    "createCloudConsciousnessLiveProviderRuntimeAdapterModuleTask",
    taskFields(["moduleContract"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-request-builder-tasks",
    "createCloudConsciousnessLiveProviderRequestBuilderTask",
    taskFields(["requestBuilder"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-reference-resolver-tasks",
    "createCloudConsciousnessLiveProviderCredentialReferenceResolverTask",
    taskFields(["credentialResolver"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-no-network-sender-tasks",
    "createCloudConsciousnessLiveProviderNoNetworkSenderTask",
    taskFields(["noNetworkSender"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-egress-transcript-recorder-tasks",
    "createCloudConsciousnessLiveProviderEgressTranscriptRecorderTask",
    taskFields(["transcriptRecorder"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-response-verifier-tasks",
    "createCloudConsciousnessLiveProviderResponseVerifierTask",
    taskFields(["responseVerifier"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-rollback-note-tasks",
    "createCloudConsciousnessLiveProviderRollbackNoteTask",
    taskFields(["rollbackNote"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-runtime-adapter-closure-tasks",
    "createCloudConsciousnessLiveProviderRuntimeAdapterClosureTask",
    taskFields(["completion"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-real-launch-tasks",
    "createCloudConsciousnessLiveProviderRealLaunchTask",
    taskFields(["routeReview"]),
  ),
  postRoute(
    "/cloud-consciousness/live-provider-real-launch-execution-preflight",
    "recordCloudConsciousnessLiveProviderRealLaunchExecutionPreflight",
    preflightFields,
  ),
]);

export const handleCloudLiveProviderTaskPostRoute = createConfirmPostRouteHandler({
  routes: LIVE_PROVIDER_TASK_POST_ROUTES,
  missingHandlerLabel: "cloud live-provider task",
});
