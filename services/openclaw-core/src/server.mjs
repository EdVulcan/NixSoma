// services/openclaw-core/src/server.mjs
import http from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { corsHeaders, sendJson, readJsonBody, createEventPublisher, registerService } from "../../../packages/shared-utils/src/http.mjs";


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
const port = Number.parseInt(process.env.OPENCLAW_CORE_PORT ?? "4100", 10);
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const sessionManagerUrl = process.env.OPENCLAW_SESSION_MANAGER_URL ?? "http://127.0.0.1:4102";
const browserRuntimeUrl = process.env.OPENCLAW_BROWSER_RUNTIME_URL ?? "http://127.0.0.1:4103";
const screenSenseUrl = process.env.OPENCLAW_SCREEN_SENSE_URL ?? "http://127.0.0.1:4104";
const screenActUrl = process.env.OPENCLAW_SCREEN_ACT_URL ?? "http://127.0.0.1:4105";
const systemSenseUrl = process.env.OPENCLAW_SYSTEM_SENSE_URL ?? "http://127.0.0.1:4106";
const systemHealUrl = process.env.OPENCLAW_SYSTEM_HEAL_URL ?? "http://127.0.0.1:4107";
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

const policyEvaluator = createPolicyEvaluator({ state });

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

const approvalEngine = createApprovalEngine({ state, taskManager });

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
  selectOpenClawToolCatalogWorkspace: (args) => pluginReview.selectOpenClawToolCatalogWorkspace(args)
});

const planBuilder = createPlanBuilder({
  client,
  state,
  taskManager,
  pluginReview,
  approvalEngine,
  policyEvaluator,
  publishEvent,
});

const executor = createTaskExecutor({
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

state.loadPersistentState();
taskManager.reconcileRuntimeState();

server.listen(port, host, async () => {
  console.log(`openclaw-core listening on http://${host}:${port}`);
  await registerService(eventHubUrl, "openclaw-core", `http://${host}:${port}`);
  await publishEvent("service.started", {
    service: "openclaw-core",
    url: `http://${host}:${port}`,
  });
});
