import { sendJson } from "../../../packages/shared-utils/src/http.mjs";
import { handleApprovalRoute } from "./approval-routes.mjs";
import { handleCoreInfrastructureRoute } from "./core-infrastructure-routes.mjs";
import { handleCoreRuntimeReadRoute } from "./core-runtime-read-routes.mjs";
import { handleCloudConsciousnessReadRoute } from "./cloud-consciousness-read-routes.mjs";
import { handleCloudLiveProviderCredentialPostRoute } from "./cloud-live-provider-credential-post-routes.mjs";
import { handleCloudLiveProviderResultEnvelopeGetRoute } from "./cloud-live-provider-result-envelope-routes.mjs";
import { handleCloudLiveProviderTaskPostRoute } from "./cloud-live-provider-task-post-routes.mjs";
import { handleDomainTaskPostRoute } from "./domain-task-post-routes.mjs";
import { handleNativeAdapterPluginRoute } from "./native-adapter-plugin-routes.mjs";
import { handleNativeAcpxCodexProcessSpawnTaskRoute } from "./native-acpx-codex-process-spawn-task-routes.mjs";
import { handleNativeEngineeringPlanTodoWorkbenchRoute } from "./native-engineering-plan-todo-workbench-routes.mjs";
import { handleNativeEngineeringContextRoute } from "./native-engineering-context-routes.mjs";
import { handleNativePluginRuntimeRoute } from "./native-plugin-runtime-routes.mjs";
import { handleObserverReadModelRoute } from "./observer-read-model-routes.mjs";
import { handleOperatorControlRoute } from "./operator-control-routes.mjs";
import { handlePhaseMemoryReadRoute } from "./phase-memory-read-routes.mjs";
import { handlePolicyCapabilityRoute } from "./policy-capability-routes.mjs";
import { handleSystemdDraftRoute } from "./systemd-draft-routes.mjs";
import { handleTaskRoute } from "./task-routes.mjs";
import { handleWorkViewSidecarTaskRoute } from "./work-view-sidecar-task-routes.mjs";
import { handleWorkspaceNativeOpsRoute } from "./workspace-native-ops-routes.mjs";
import { handleWorkspacePluginReadRoute } from "./workspace-plugin-read-routes.mjs";

export function registerRoutes(deps) {
  const { state, client, policyEvaluator, approvalEngine, taskManager, pluginReview, workspaceOps, planBuilder, executor, publishEvent, host, port, stateFilePath, eventHubUrl, sessionManagerUrl, browserRuntimeUrl, screenSenseUrl, screenActUrl, systemSenseUrl, systemHealUrl } = deps;

  const { reconcileApprovalExpirations, serialiseApproval } = approvalEngine;
  const { buildTaskSummary, serialiseTask } = taskManager;
  const { serialisePlanForPublic } = planBuilder;
  const config = { host, port, stateFilePath };
  const serviceUrls = {
    eventHubUrl,
    sessionManagerUrl,
    browserRuntimeUrl,
    screenSenseUrl,
    screenActUrl,
    systemSenseUrl,
    systemHealUrl,
  };

  return async function handleRequest(req, res, requestUrl) {
    if (await handleCoreInfrastructureRoute({ req, res, requestUrl, client, state, config, serviceUrls })) {
      return;
    }

    if (await handlePhaseMemoryReadRoute({ req, res, requestUrl, planBuilder })) {
      return;
    }

    if (await handleCloudConsciousnessReadRoute({ req, res, requestUrl, planBuilder })) {
      return;
    }

    if (await handleCloudLiveProviderResultEnvelopeGetRoute({ req, res, requestUrl, planBuilder })) {
      return;
    }

    reconcileApprovalExpirations();

    if (await handleCoreRuntimeReadRoute({ req, res, requestUrl, state, taskManager })) {
      return;
    }

    if (await handleTaskRoute({ req, res, requestUrl, state, approvalEngine, taskManager, planBuilder, executor, publishEvent })) {
      return;
    }

    if (await handleOperatorControlRoute({
      req,
      res,
      requestUrl,
      state,
      taskManager,
      executor,
      publishEvent,
      postJson: client.postJson,
      sessionManagerUrl,
    })) {
      return;
    }

    if (await handlePolicyCapabilityRoute({
      req,
      res,
      requestUrl,
      policyEvaluator,
      planBuilder,
      publishEvent,
    })) {
      return;
    }

    if (await handleWorkspacePluginReadRoute({ req, res, requestUrl, pluginReview })) {
      return;
    }

    if (await handleNativeAdapterPluginRoute({
      req,
      res,
      requestUrl,
      pluginReview,
      serialiseTask,
      serialiseApproval,
    })) {
      return;
    }

    if (await handleWorkspaceNativeOpsRoute({
      req,
      res,
      requestUrl,
      workspaceOps,
      serialisePlanForPublic,
      serialiseTask,
      serialiseApproval,
      buildTaskSummary,
    })) {
      return;
    }

    if (await handleNativePluginRuntimeRoute({
      req,
      res,
      requestUrl,
      planBuilder,
      serialiseTask,
      serialiseApproval,
      buildTaskSummary,
    })) {
      return;
    }

    if (await handleNativeEngineeringPlanTodoWorkbenchRoute({
      req,
      res,
      requestUrl,
      state,
      publishEvent,
    })) {
      return;
    }

    if (await handleNativeEngineeringContextRoute({
      req,
      res,
      requestUrl,
      state,
      executor,
      planBuilder,
      publishEvent,
    })) {
      return;
    }

    if (await handleNativeAcpxCodexProcessSpawnTaskRoute({
      req,
      res,
      requestUrl,
      state,
      executor,
      taskManager,
      approvalEngine,
      publishEvent,
      serialiseTask,
      serialiseApproval,
      buildTaskSummary,
    })) {
      return;
    }

    if (await handleWorkViewSidecarTaskRoute({
      req,
      res,
      requestUrl,
      sessionManagerUrl,
      state,
      taskManager,
      approvalEngine,
      publishEvent,
      serialiseTask,
      serialiseApproval,
      serialisePlanForPublic,
      buildTaskSummary,
    })) {
      return;
    }

    if (await handleSystemdDraftRoute({ req, res, requestUrl, planBuilder })) {
      return;
    }

    if (await handleDomainTaskPostRoute({
      req,
      res,
      requestUrl,
      planBuilder,
      serialiseTask,
      serialiseApproval,
      buildTaskSummary,
    })) {
      return;
    }

    if (await handleCloudLiveProviderTaskPostRoute({
      req,
      res,
      requestUrl,
      planBuilder,
      serialiseTask,
      serialiseApproval,
      buildTaskSummary,
    })) {
      return;
    }

    if (await handleCloudLiveProviderCredentialPostRoute({
      req,
      res,
      requestUrl,
      planBuilder,
      serialiseTask,
      serialiseApproval,
      buildTaskSummary,
    })) {
      return;
    }

    if (await handleObserverReadModelRoute({ req, res, requestUrl, state, planBuilder, executor })) {
      return;
    }

    if (await handleApprovalRoute({ req, res, requestUrl, state, approvalEngine, taskManager, publishEvent })) {
      return;
    }

    sendJson(res, 404, { ok: false, error: "Route not found." });

  };
}
