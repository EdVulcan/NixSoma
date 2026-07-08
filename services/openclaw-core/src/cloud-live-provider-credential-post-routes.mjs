import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

const serialisedTask = { output: "task", source: "task", transform: "task" };
const serialisedApproval = { output: "approval", source: "approval", transform: "approval" };

const gateFields = ["status", "gate", serialisedTask];
const serialisedPreflightFields = ["status", "preflight", serialisedTask];
const rawPreflightFields = ["status", "preflight", "task"];
const taskRouteFields = ["sourceRegistry", "route", serialisedTask, serialisedApproval];
const resultEnvelopeTaskRouteFields = ["sourceRegistry", "route", serialisedTask, serialisedApproval];

function postRoute(pathname, action, fields) {
  return [pathname, { action, fields }];
}

const CREDENTIAL_POST_ROUTES = new Map([
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-access-gate",
    "recordCloudConsciousnessLiveProviderCredentialValueAccessGate",
    gateFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-endpoint-network-egress-gate",
    "recordCloudConsciousnessLiveProviderEndpointNetworkEgressGate",
    gateFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-egress-execution-route-task-preflight",
    "recordCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight",
    serialisedPreflightFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-egress-execution-tasks",
    "createCloudConsciousnessLiveProviderEgressExecutionTask",
    ["sourceRegistry", "sourceTaskId", "preflight", serialisedTask, serialisedApproval],
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-readiness-preflight",
    "recordCloudConsciousnessLiveProviderCredentialValueReadinessPreflight",
    serialisedPreflightFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-final-readiness-preflight",
    "recordCloudConsciousnessLiveProviderCredentialValueFinalReadinessPreflight",
    rawPreflightFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-final-readiness-preflight",
    "recordCloudConsciousnessLiveProviderCredentialValueLocalReadFinalReadinessPreflight",
    rawPreflightFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-access-authorized-local-proof",
    "recordCloudConsciousnessLiveProviderCredentialValueAccessAuthorizedLocalProof",
    ["status", "proof", "task"],
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-authorization-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueAuthorizationTask",
    taskRouteFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-read-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueReadTask",
    ["sourceRegistry", "preflight", serialisedTask, serialisedApproval],
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-access-authorization-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationTask",
    taskRouteFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-final-readiness-preflight",
    "recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflight",
    rawPreflightFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-final-readiness-preflight",
    "recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadFinalReadinessPreflight",
    rawPreflightFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-final-readiness-preflight",
    "recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptFinalReadinessPreflight",
    rawPreflightFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight",
    "recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadFinalReadinessPreflight",
    rawPreflightFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight",
    "recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeFinalReadinessPreflight",
    rawPreflightFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight",
    "recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationFinalReadinessPreflight",
    rawPreflightFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-access-authorization-decision-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionTask",
    taskRouteFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight",
    "recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflight",
    rawPreflightFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight",
    "recordCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptFinalReadinessPreflight",
    rawPreflightFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueLocalReadTask",
    taskRouteFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionTask",
    taskRouteFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadTask",
    taskRouteFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptTask",
    taskRouteFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadTask",
    taskRouteFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadTask",
    resultEnvelopeTaskRouteFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeTask",
    resultEnvelopeTaskRouteFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationTask",
    resultEnvelopeTaskRouteFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTask",
    resultEnvelopeTaskRouteFields,
  ),
  postRoute(
    "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-tasks",
    "createCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTask",
    resultEnvelopeTaskRouteFields,
  ),
]);

function routeFieldValue(field, result, { serialiseTask, serialiseApproval }) {
  if (typeof field === "string") {
    return [field, result[field]];
  }

  if (field.transform === "task") {
    return [field.output, serialiseTask(result[field.source])];
  }

  if (field.transform === "approval") {
    return [field.output, serialiseApproval(result[field.source])];
  }

  return [field.output, result[field.source]];
}

function buildCredentialPostResponse(result, route, context) {
  const response = {
    ok: true,
    registry: result.registry,
    mode: result.mode,
    generatedAt: result.generatedAt,
  };

  for (const field of route.fields) {
    const [key, value] = routeFieldValue(field, result, context);
    response[key] = value;
  }

  response.governance = result.governance;
  response.summary = context.buildTaskSummary();
  return response;
}

export async function handleCloudLiveProviderCredentialPostRoute({
  req,
  res,
  requestUrl,
  planBuilder,
  serialiseTask,
  serialiseApproval,
  buildTaskSummary,
}) {
  if (req.method !== "POST") {
    return false;
  }

  const route = CREDENTIAL_POST_ROUTES.get(requestUrl.pathname);
  if (!route) {
    return false;
  }

  try {
    const body = await readJsonBody(req);
    const action = planBuilder?.[route.action];
    if (typeof action !== "function") {
      throw new Error(`Missing cloud live-provider credential POST handler: ${route.action}`);
    }

    const result = await action.call(planBuilder, {
      confirm: body.confirm === true,
    });
    sendJson(res, 201, buildCredentialPostResponse(result, route, {
      serialiseTask,
      serialiseApproval,
      buildTaskSummary,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendJson(res, 400, { ok: false, error: message });
  }

  return true;
}
