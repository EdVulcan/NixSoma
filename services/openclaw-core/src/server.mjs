// services/openclaw-core/src/server.mjs
import http from "node:http";
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
import { createNativeEngineeringExperienceMemory } from "./native-engineering-experience-memory.mjs";
import { createOperatorAuthenticator } from "./operator-auth.mjs";
import { createExecutionGrantSigner } from "../../../packages/shared-utils/src/execution-grants.mjs";
import { createFixedUnitIncidentScheduler } from "./fixed-unit-incident-scheduler.mjs";
import {
  createFixedUnitIncidentApprovedDispatcher,
  reconcileFixedUnitIncidentDispatchesAtStartup,
} from "./fixed-unit-incident-approved-dispatch.mjs";

// configure state & client
const host = process.env.OPENCLAW_CORE_HOST ?? "127.0.0.1";
const port = getOpenClawServicePort("core");
const observerUiPort = getOpenClawServicePort("observerUi");
const eventHubUrl = getOpenClawServiceUrl("eventHub");
const sessionManagerUrl = getOpenClawServiceUrl("sessionManager");
const browserRuntimeUrl = getOpenClawServiceUrl("browserRuntime");
const screenSenseUrl = getOpenClawServiceUrl("screenSense");
const screenActUrl = getOpenClawServiceUrl("screenAct");
const systemSenseUrl = getOpenClawServiceUrl("systemSense");
const systemHealUrl = getOpenClawServiceUrl("systemHeal");
const stateFilePath = process.env.OPENCLAW_CORE_STATE_FILE
  ?? path.resolve(process.cwd(), "../../.artifacts/openclaw-core-state.json");
const operatorAuth = createOperatorAuthenticator({
  allowedOrigins: process.env.OPENCLAW_OPERATOR_ALLOWED_ORIGINS
    ?? [`http://127.0.0.1:${observerUiPort}`, `http://localhost:${observerUiPort}`],
});

const publishEvent = createEventPublisher(eventHubUrl, "openclaw-core");
const publishAuditEvent = createEventPublisher(eventHubUrl, "openclaw-core", fetch, { required: true });

const urls = { eventHubUrl, sessionManagerUrl, browserRuntimeUrl, screenSenseUrl, screenActUrl, systemSenseUrl, systemHealUrl };

const executionGrantSigner = createExecutionGrantSigner({
  privateKeyFilePath: process.env.OPENCLAW_EXECUTION_GRANT_PRIVATE_KEY_FILE,
  required: false,
});
const client = createServiceClient(urls, { executionGrantSigner });

// We need getTaskById for runtime-state, but getTaskById is in task-manager which depends on runtimeState.
// To solve this, we can initialize state first, and then inject taskManager!
const state = createRuntimeState({
  stateFilePath,
  getTaskById: (id) => taskManager.getTaskById(id)
});
const experienceMemory = createNativeEngineeringExperienceMemory({
  records: state.experienceMemoryRecords,
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
  recordTaskExperience: (task) => experienceMemory.recordTaskExperience(task),
});

const approvalEngine = createApprovalEngine({ state, taskManager, policyEvaluator, publishEvent });
let fixedUnitIncidentScheduler = null;

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
  publishAuditEvent,
  host,
  port,
  listCommandTranscriptRecords: (options) => executor?.listCommandTranscriptRecords(options) ?? [],
  listFilesystemChangeRecords: (options) => executor?.listFilesystemChangeRecords(options) ?? [],
  buildExperienceMemoryReadModel: (...args) => experienceMemory.buildExperienceMemoryReadModel(...args),
});

executor = createTaskExecutor({
  client,
  state,
  taskManager,
  buildExperienceMemoryReadModel: (...args) => experienceMemory.buildExperienceMemoryReadModel(...args),
  planBuilder,
  approvalEngine,
  workspaceOps,
  policyEvaluator,
  publishEvent,
});
const dispatchApprovedFixedUnitRepair = createFixedUnitIncidentApprovedDispatcher({
  tasks: state.tasks,
  approvals: state.approvals,
  schedulerState: state.fixedUnitIncidentSchedulerState,
  realExecutionRegistry: state.SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY,
  executeTaskWithRecovery: (task, options) => executor.executeTaskWithRecovery(task, options),
  failTask: (task, reason, details) => taskManager.failTask(task, reason, details),
  persistState: state.persistState,
  publishAuditEvent,
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
  operatorAuth,
  dispatchApprovedFixedUnitRepair,
  buildExperienceMemoryReadModel: (...args) => experienceMemory.buildExperienceMemoryReadModel(...args),
});

// create server
const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);
    res.openclawCorsHeaders = operatorAuth.buildCorsHeaders(req);

    const origin = operatorAuth.authorizeOrigin(req);
    if (!origin.ok) {
      res.openclawResponseHeaders = origin.headers;
      sendJson(res, origin.statusCode, { ok: false, error: origin.error });
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders(res.openclawCorsHeaders));
      res.end();
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/auth/login") {
      try {
        const body = await readJsonBody(req);
        const session = operatorAuth.createSession(body.token);
        if (!session.ok) {
          res.openclawResponseHeaders = session.headers;
          sendJson(res, session.statusCode, { ok: false, error: session.error });
          return;
        }
        res.openclawResponseHeaders = { "set-cookie": session.setCookie };
        sendJson(res, 200, {
          ok: true,
          operator: session.identity,
          expiresAt: session.identity.sessionExpiresAt,
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: error instanceof Error ? error.message : "Invalid operator login request.",
        });
      }
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/auth/session") {
      const session = operatorAuth.authenticateRequest(req, { requireAuth: true });
      if (!session.ok) {
        res.openclawResponseHeaders = session.headers;
        sendJson(res, session.statusCode, { ok: false, error: session.error });
        return;
      }
      sendJson(res, 200, { ok: true, operator: session.identity });
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/auth/logout") {
      const session = operatorAuth.authenticateRequest(req, { requireAuth: true });
      if (!session.ok) {
        res.openclawResponseHeaders = session.headers;
        sendJson(res, session.statusCode, { ok: false, error: session.error });
        return;
      }
      res.openclawResponseHeaders = { "set-cookie": operatorAuth.clearSession(req) };
      sendJson(res, 200, { ok: true, loggedOut: true });
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
  fixedUnitIncidentScheduler?.stop();
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
const standingProviderAdvisoryRestore = planBuilder.restoreStandingProviderAdvisoryState();
if (!standingProviderAdvisoryRestore.ok) {
  console.warn(`Standing provider advisory state was reset: ${standingProviderAdvisoryRestore.reason}`);
}
const nativePluginRuntimeRestore = planBuilder.restoreNativePluginRuntimeState();
if (!nativePluginRuntimeRestore.ok && nativePluginRuntimeRestore.restored === false) {
  console.warn(`Native plugin runtime generation state was reset: ${nativePluginRuntimeRestore.reason}`);
}
taskManager.reconcileInterruptedTasksAtStartup();
taskManager.reconcileInterruptedCapabilityReservationsAtStartup();
const fixedUnitDispatchStartupRecovery = reconcileFixedUnitIncidentDispatchesAtStartup({
  tasks: state.tasks,
  schedulerState: state.fixedUnitIncidentSchedulerState,
  failTask: (task, reason, details) => taskManager.failTask(task, reason, details),
  persistState: state.persistState,
});
if (fixedUnitDispatchStartupRecovery.reconciledCount > 0) {
  console.warn(`Failed ${fixedUnitDispatchStartupRecovery.reconciledCount} interrupted fixed-unit dispatch(es) closed.`);
}
taskManager.reconcileRuntimeState();
fixedUnitIncidentScheduler = createFixedUnitIncidentScheduler({
  enabled: process.env.OPENCLAW_FIXED_UNIT_INCIDENT_SCHEDULER_ENABLED === "1",
  intervalMs: process.env.OPENCLAW_FIXED_UNIT_INCIDENT_SCHEDULER_INTERVAL_MS,
  fetchJson: (url) => client.fetchJson(url),
  systemSenseUrl,
  taskManager,
  createIncidentTriageTask: ({ sourceTaskId }) => planBuilder.createAutomaticFixedUnitIncidentTriageTask({ sourceTaskId }),
  createIncidentRepairTask: ({ triageTaskId }) => planBuilder.createAutomaticFixedUnitIncidentRepairTask({ triageTaskId }),
  schedulerState: state.fixedUnitIncidentSchedulerState,
  persistState: state.persistState,
  publishAuditEvent,
});

server.listen(port, host, async () => {
  console.log(`openclaw-core listening on http://${host}:${port}`);
  await registerService(eventHubUrl, "openclaw-core", `http://${host}:${port}`);
  await publishEvent("service.started", {
    service: "openclaw-core",
    url: `http://${host}:${port}`,
  });
  fixedUnitIncidentScheduler?.start();
});
