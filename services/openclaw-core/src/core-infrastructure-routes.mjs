import { sendJson } from "../../../packages/shared-utils/src/http.mjs";
import { projectAiCompositorFrame } from "../../../packages/shared-utils/src/ai-compositor-frame.mjs";

const AI_COMPOSITOR_PROJECTION_PATH = "/work-view/compositor-frame";
const AI_COMPOSITOR_PROJECTION_REGISTRY = "nixsoma-ai-output-projection-v0";
const AI_COMPOSITOR_WIDTH = 1280;
const AI_COMPOSITOR_HEIGHT = 720;

const PROXY_TARGET_URL_KEYS = {
  "session-manager": "sessionManagerUrl",
  "event-hub": "eventHubUrl",
  "system-heal": "systemHealUrl",
  "screen-sense": "screenSenseUrl",
  "screen-act": "screenActUrl",
  "system-sense": "systemSenseUrl",
};

const READ_ONLY_PROXY_PATHS = {
  "session-manager": new Set(["/health", "/session/state", "/work-view/state", AI_COMPOSITOR_PROJECTION_PATH]),
  "screen-sense": new Set(["/health", "/screen/current", "/screen/provider", "/screen/windows", "/screen/ocr"]),
  "screen-act": new Set(["/health", "/act/state"]),
  "system-heal": new Set([
    "/health",
    "/heal/state",
    "/heal/history",
    "/maintenance/state",
    "/maintenance/policy",
    "/maintenance/history",
  ]),
  "system-sense": new Set([
    "/health",
    "/system/health",
    "/system/health/trends",
    "/system/route/next-action",
    "/system/route/recovery-policy",
    "/system/route/body-governance-readiness",
    "/system/route/phase-2-review",
    "/system/route/body-evidence-timeline",
    "/system/route/body-evidence-timeline-readiness",
    "/system/route/body-evidence-ledger-plan",
    "/system/route/body-evidence-ledger-route-review",
    "/system/route/body-evidence-ledger-storage-root-plan",
    "/system/route/body-evidence-ledger-storage-root-route-review",
    "/system/route/body-evidence-ledger-first-record-plan",
    "/system/route/body-evidence-ledger-first-record-route-review",
    "/system/route/body-evidence-ledger-readiness",
    "/system/route/body-evidence-ledger-demo-status",
    "/system/route/body-evidence-ledger-followup-record-plan",
    "/system/route/body-evidence-ledger-followup-record-route-review",
    "/system/body",
    "/system/services",
    "/system/alerts",
    "/system/processes",
    "/system/systemd/units",
    "/system/systemd/dependency-map",
    "/system/systemd/repair-candidates",
    "/system/systemd/repair-candidate-plan",
    "/system/systemd/repair-candidate-task-route",
    "/system/systemd/repair-candidate-readiness",
    "/system/systemd/repair-candidate-route-review",
    "/system/systemd/repair-candidate-demo-status",
    "/system/systemd/next-repair-scope-review",
    "/system/systemd/next-repair-plan",
    "/system/systemd/next-repair-route-review",
    "/system/systemd/next-repair-dry-run",
    "/system/systemd/next-repair-task-route",
    "/system/systemd/repair-plan",
    "/system/systemd/repair-dry-run",
    "/system/systemd/boot-evidence",
    "/system/kernel/process-exec-events",
    "/system/kernel/network-connect-events",
  ]),
};

function proxySubpath(pathname) {
  const parts = pathname.split("/");
  return "/" + parts.slice(3).join("/");
}

function projectAiCompositorOutput(result) {
  const frame = projectAiCompositorFrame(result?.frame, {
    includeData: true,
    width: AI_COMPOSITOR_WIDTH,
    height: AI_COMPOSITOR_HEIGHT,
  });
  if (!frame.available || frame.socketName !== "nixsoma-ai-0" || frame.fresh !== true) {
    return null;
  }
  return {
    ok: true,
    registry: AI_COMPOSITOR_PROJECTION_REGISTRY,
    mode: "operator_transient",
    frame,
    boundary: {
      sourceScope: "ai_owned_nested_output_only",
      operatorAuthenticationRequired: true,
      serverPersistence: false,
      browserMemoryOnly: true,
      parentDisplayConnected: false,
      desktopWideCapture: false,
      inputAuthorityExpanded: false,
      rootRequired: false,
      hostMutation: false,
    },
  };
}

async function handleProxyRoute({
  req,
  res,
  requestUrl,
  client,
  serviceUrls,
}) {
  if (!requestUrl.pathname.startsWith("/proxy/")) {
    return false;
  }

  const targetService = requestUrl.pathname.split("/")[2];
  const targetUrlKey = PROXY_TARGET_URL_KEYS[targetService];
  const targetUrlBase = targetUrlKey ? serviceUrls[targetUrlKey] : null;
  if (!targetUrlBase) {
    return false;
  }

  if (req.method !== "GET" || !READ_ONLY_PROXY_PATHS[targetService]?.has(proxySubpath(requestUrl.pathname))) {
    sendJson(res, req.method === "GET" ? 404 : 405, {
      ok: false,
      error: "Core proxy exposes only allowlisted read-only GET routes.",
    });
    return true;
  }

  try {
    const targetPath = proxySubpath(requestUrl.pathname);
    const targetUrl = new URL(targetPath, targetUrlBase);
    targetUrl.search = requestUrl.search;
    const result = await client.fetchJson(targetUrl.toString());
    if (targetService === "session-manager" && targetPath === AI_COMPOSITOR_PROJECTION_PATH) {
      const projection = projectAiCompositorOutput(result);
      if (!projection) {
        sendJson(res, 502, { ok: false, error: "AI compositor projection returned an invalid or stale frame." });
        return true;
      }
      res.openclawResponseHeaders = {
        ...(res.openclawResponseHeaders ?? {}),
        "cache-control": "no-store, no-cache, must-revalidate",
        pragma: "no-cache",
        expires: "0",
      };
      sendJson(res, 200, projection);
      return true;
    }
    sendJson(res, 200, result);
    return true;
  } catch (error) {
    sendJson(res, 502, { ok: false, error: `Proxy failed: ${error.message}` });
    return true;
  }
}

function handleHealthRoute({
  req,
  res,
  requestUrl,
  state,
  config,
  serviceUrls,
}) {
  if (req.method !== "GET" || requestUrl.pathname !== "/health") {
    return false;
  }

  sendJson(res, 200, {
    ok: true,
    service: "openclaw-core",
    stage: "active",
    host: config.host,
    port: config.port,
    eventHubUrl: serviceUrls.eventHubUrl,
    sessionManagerUrl: serviceUrls.sessionManagerUrl,
    browserRuntimeUrl: serviceUrls.browserRuntimeUrl,
    screenSenseUrl: serviceUrls.screenSenseUrl,
    screenActUrl: serviceUrls.screenActUrl,
    systemSenseUrl: serviceUrls.systemSenseUrl,
    systemHealUrl: serviceUrls.systemHealUrl,
    stateFilePath: config.stateFilePath,
    autonomyMode: state.autonomyMode,
  });
  return true;
}

export async function handleCoreInfrastructureRoute({
  req,
  res,
  requestUrl,
  client,
  state,
  config,
  serviceUrls,
}) {
  if (await handleProxyRoute({ req, res, requestUrl, client, serviceUrls })) {
    return true;
  }
  return handleHealthRoute({ req, res, requestUrl, state, config, serviceUrls });
}
