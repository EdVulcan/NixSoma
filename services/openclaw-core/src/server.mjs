// services/openclaw-core/src/server.mjs
import http from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { corsHeaders, sendJson, readJsonBody, createEventPublisher, registerService } from "../../../packages/shared-utils/src/http.mjs";
import { getOpenClawServicePort, getOpenClawServiceUrl } from "../../../packages/shared-client/src/service-descriptors.mjs";


import { createRuntimeState } from "./runtime-state.mjs";
import { createServiceClient } from "./service-client.mjs";
import { createPolicyEvaluator } from "./policy-evaluator.mjs";
import { createApprovalEngine } from "./approval-engine.mjs";
import { createTaskManager } from "./task-manager.mjs";
import { createPluginReview } from "./plugin-review.mjs";
import { createWorkspaceOps } from "./workspace-ops.mjs";
import { createPlanBuilder } from "./plan-builder.mjs";
import { createTaskExecutor } from "./task-executor.mjs";
import { registerRoutes } from "./route-handlers.mjs";

// configure state & client
const host = process.env.OPENCLAW_CORE_HOST ?? "127.0.0.1";
const port = getOpenClawServicePort("core");
const eventHubUrl = getOpenClawServiceUrl("eventHub");
const sessionManagerUrl = getOpenClawServiceUrl("sessionManager");
const browserRuntimeUrl = getOpenClawServiceUrl("browserRuntime");
const screenSenseUrl = getOpenClawServiceUrl("screenSense");
const screenActUrl = getOpenClawServiceUrl("screenAct");
const systemSenseUrl = getOpenClawServiceUrl("systemSense");
const systemHealUrl = getOpenClawServiceUrl("systemHeal");
const stateFilePath = process.env.OPENCLAW_CORE_STATE_FILE
  ?? path.resolve(process.cwd(), "../../.artifacts/openclaw-core-state.json");

const publishEvent = createEventPublisher(eventHubUrl, "openclaw-core");

const urls = { eventHubUrl, sessionManagerUrl, browserRuntimeUrl, screenSenseUrl, screenActUrl, systemSenseUrl, systemHealUrl };

const client = createServiceClient(urls);

// We need getTaskById for runtime-state, but getTaskById is in task-manager which depends on runtimeState.
// To solve this, we can initialize state first, and then inject taskManager!
const state = createRuntimeState({
  stateFilePath,
  getTaskById: (id) => taskManager.getTaskById(id)
});

const policyEvaluator = createPolicyEvaluator({
  state,
  createApprovalRequestForTask: (task, decision) => approvalEngine.createApprovalRequestForTask(task, decision),
});

const taskManager = createTaskManager({
  state,
  buildRulePlan: (args) => planBuilder.buildRulePlan(args),
  shouldBuildPlan: (args) => planBuilder.shouldBuildPlan(args),
  serialisePlanForPublic: (plan) => planBuilder.serialisePlanForPublic(plan),
  updatePlanForPhase: (...args) => planBuilder.updatePlanForPhase(...args),
  ensureTaskPolicy: (task, context) => policyEvaluator.ensureTaskPolicy(task, context),
  createApprovalRequestForTask: (task, decision) => approvalEngine.createApprovalRequestForTask(task, decision),
  publishEvent,
});

const approvalEngine = createApprovalEngine({ state, taskManager, policyEvaluator, publishEvent });

const pluginReview = createPluginReview({
  client,
  state,
  taskManager,
  approvalEngine,
  serialisePlanForPublic: (plan) => planBuilder.serialisePlanForPublic(plan),
  publishEvent,
});

const workspaceOps = createWorkspaceOps({
  client,
  state,
  selectOpenClawToolCatalogWorkspace: (args) => pluginReview.selectOpenClawToolCatalogWorkspace(args),
  buildWorkspaceCommandProposals: (...args) => pluginReview.buildWorkspaceCommandProposals(...args),
  buildOpenClawSourceCommandProposals: (...args) => pluginReview.buildOpenClawSourceCommandProposals(...args),
  buildNativeOpenClawToolCatalogProfile: (...args) => pluginReview.buildNativeOpenClawToolCatalogProfile(...args),
  buildNativeOpenClawWorkspaceSemanticIndex: (...args) => pluginReview.buildNativeOpenClawWorkspaceSemanticIndex(...args),
  buildNativeOpenClawWorkspaceEditTargetSelection: (...args) => pluginReview.buildNativeOpenClawWorkspaceEditTargetSelection(...args),
  buildNativeOpenClawPromptSemanticsProfile: (...args) => pluginReview.buildNativeOpenClawPromptSemanticsProfile(...args),
  buildNativeEngineeringEditProposal: (...args) => pluginReview.buildNativeEngineeringEditProposal(...args),
  buildNativeEngineeringWriteProposal: (...args) => pluginReview.buildNativeEngineeringWriteProposal(...args),
  buildNativeAcpxCodexBridgeWrapperWriteProposal: (...args) => pluginReview.buildNativeAcpxCodexBridgeWrapperWriteProposal(...args),
  buildNativeEngineeringLspLifecycleDraft: (...args) => pluginReview.buildNativeEngineeringLspLifecycleDraft(...args),
  buildNativeEngineeringLspSourceTransferProposal: (...args) => pluginReview.buildNativeEngineeringLspSourceTransferProposal(...args),
  buildNativeEngineeringLspSymbolRequestProposal: (...args) => pluginReview.buildNativeEngineeringLspSymbolRequestProposal(...args),
  buildRulePlan: (args) => planBuilder.buildRulePlan(args),
  createTask: (...args) => taskManager.createTask(...args),
  supersedeOtherActiveTasks: (taskId) => taskManager.supersedeOtherActiveTasks(taskId),
  reconcileRuntimeState: () => taskManager.reconcileRuntimeState(),
  serialiseTask: (task) => taskManager.serialiseTask(task),
  serialisePlanForPublic: (plan) => planBuilder.serialisePlanForPublic(plan),
  createApprovalRequestForTask: (task, decision) => approvalEngine.createApprovalRequestForTask(task, decision),
  serialiseApproval: (approval) => approvalEngine.serialiseApproval(approval),
  publishTaskApprovalIfPending: (task) => approvalEngine.publishTaskApprovalIfPending(task),
  publishEvent,
});

let executor = null;
const planBuilder = createPlanBuilder({
  client,
  state,
  taskManager,
  workspaceOps,
  pluginReview,
  approvalEngine,
  policyEvaluator,
  publishEvent,
  host,
  port,
  listCommandTranscriptRecords: (options) => executor?.listCommandTranscriptRecords(options) ?? [],
  listFilesystemChangeRecords: (options) => executor?.listFilesystemChangeRecords(options) ?? [],
});

executor = createTaskExecutor({
  client,
  state,
  taskManager,
  planBuilder,
  approvalEngine,
  workspaceOps,
  policyEvaluator,
  publishEvent,
});

// register routes
const handleRequest = registerRoutes({
  state,
  client,
  policyEvaluator,
  approvalEngine,
  taskManager,
  pluginReview,
  workspaceOps,
  planBuilder,
  executor,
  publishEvent,
  host,
  port,
  stateFilePath,
  eventHubUrl,
  sessionManagerUrl,
  browserRuntimeUrl,
  screenSenseUrl,
  screenActUrl,
  systemSenseUrl,
  systemHealUrl,
});

// create server
const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    await handleRequest(req, res, requestUrl);
  } catch (error) {
    console.error("Unhandled core request error:", error);
    if (!res.headersSent) {
      sendJson(res, 500, { ok: false, error: "Internal server error." });
    }
  }
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  state.persistState.flush?.();
  if (!server.listening) {
    process.exit(0);
    return;
  }
  server.close(() => process.exit(0));
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

state.loadPersistentState();
const nativePluginRuntimeRestore = planBuilder.restoreNativePluginRuntimeState();
if (!nativePluginRuntimeRestore.ok && nativePluginRuntimeRestore.restored === false) {
  console.warn(`Native plugin runtime generation state was reset: ${nativePluginRuntimeRestore.reason}`);
}
taskManager.reconcileInterruptedTasksAtStartup();
taskManager.reconcileRuntimeState();

server.listen(port, host, async () => {
  console.log(`openclaw-core listening on http://${host}:${port}`);
  await registerService(eventHubUrl, "openclaw-core", `http://${host}:${port}`);
  await publishEvent("service.started", {
    service: "openclaw-core",
    url: `http://${host}:${port}`,
  });
});
