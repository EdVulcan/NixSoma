import http from "node:http";
import { randomUUID } from "node:crypto";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { buildTrustedWorkViewActionLease } from "./trusted-work-view-action-mediation.mjs";
import { normaliseWorkViewSemanticTargetReference } from "../../../packages/shared-utils/src/work-view-semantic-targets.mjs";
import { redactWriteOnlyInputParams } from "../../../packages/shared-utils/src/work-view-input-evidence.mjs";

const host = process.env.OPENCLAW_SCREEN_ACT_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OPENCLAW_SCREEN_ACT_PORT ?? "4105", 10);
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const screenSenseUrl = process.env.OPENCLAW_SCREEN_SENSE_URL ?? "http://127.0.0.1:4104";
const sessionManagerUrl = process.env.OPENCLAW_SESSION_MANAGER_URL ?? "http://127.0.0.1:4102";
const browserRuntimeUrl = process.env.OPENCLAW_BROWSER_RUNTIME_URL ?? "http://127.0.0.1:4103";
const screenWaitMs = Number.parseInt(process.env.OPENCLAW_SCREEN_ACT_WAIT_MS ?? "1500", 10);
const screenPollMs = Number.parseInt(process.env.OPENCLAW_SCREEN_ACT_POLL_MS ?? "100", 10);

const actionState = {
  lastAction: null,
  actionCount: 0,
  updatedAt: new Date().toISOString(),
};

import { corsHeaders, sendJson, readJsonBody, createEventPublisher, registerService } from "../../../packages/shared-utils/src/http.mjs";


const publishEvent = createEventPublisher(eventHubUrl, "openclaw-screen-act");


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isStableScreen(screen) {
  return Boolean(screen?.focusedWindow) && screen?.readiness === "ready";
}

async function getScreenContext() {
  const deadline = Date.now() + screenWaitMs;

  try {
    await fetch(`${screenSenseUrl}/screen/refresh`, { method: "POST" });

    while (Date.now() <= deadline) {
      const response = await fetch(`${screenSenseUrl}/screen/current`);
      const data = await response.json();
      const screen = data.screen ?? null;

      if (isStableScreen(screen)) {
        return {
          screen,
          degraded: false,
        };
      }

      await sleep(screenPollMs);
    }

    const response = await fetch(`${screenSenseUrl}/screen/current`);
    const data = await response.json();
    return {
      screen: data.screen ?? null,
      degraded: true,
    };
  } catch {
    return {
      screen: null,
      degraded: true,
    };
  }
}

function updateActionState(action) {
  actionState.lastAction = action;
  actionState.actionCount += 1;
  actionState.updatedAt = new Date().toISOString();
}

async function executeBrowserAction(kind, params, screen) {
  const endpoint = kind === "mouse.click"
    ? "/browser/click"
    : kind === "keyboard.type"
      ? "/browser/input"
      : kind === "browser.new_tab" ? "/browser/new-tab" : null;
  if (!endpoint) {
    return {
      registry: "openclaw-trusted-work-view-action-mediation-v0",
      attempted: false,
      required: false,
      accepted: true,
      status: "not_applicable",
      reason: null,
      leaseMatched: false,
    };
  }

  const leaseContext = buildTrustedWorkViewActionLease(screen);
  if (!leaseContext.ready) {
    return {
      registry: leaseContext.registry,
      attempted: false,
      required: leaseContext.required,
      accepted: false,
      status: "blocked",
      reason: leaseContext.reason,
      leaseMatched: false,
    };
  }

  try {
    const payload = kind === "mouse.click"
      ? params.semanticTarget
        ? { semanticTarget: params.semanticTarget }
        : { x: params.x, y: params.y }
      : kind === "browser.new_tab"
        ? { url: params.url }
        : { text: params.text ?? "" };
    const sidecarActive = Boolean(
      screen?.trustedSession?.helperRuntime?.sidecar?.taskId
      && screen.trustedSession.helperRuntime.sidecar.status === "running"
    );
    const targetUrl = sidecarActive
      ? `${sessionManagerUrl}/work-view/trusted-sidecar/action`
      : `${browserRuntimeUrl}${endpoint}`;
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sidecarActive
        ? { kind, payload, trustedHelperLease: leaseContext.trustedHelperLease }
        : { ...payload, trustedHelperLease: leaseContext.trustedHelperLease }),
    });
    const data = await response.json().catch(() => null);
    const mediation = data?.mediation ?? {};
    return {
      registry: mediation.registry ?? leaseContext.registry,
      attempted: true,
      required: mediation.required ?? leaseContext.required,
      accepted: response.ok && data?.ok === true && mediation.accepted !== false,
      status: mediation.status ?? (response.ok ? "accepted" : "rejected"),
      reason: mediation.reason ?? data?.error ?? null,
      sessionId: mediation.sessionId ?? screen?.sessionId ?? null,
      leaseId: mediation.leaseId ?? leaseContext.trustedHelperLease?.leaseId ?? null,
      leaseMatched: mediation.leaseMatched === true,
      transport: data?.transport ?? "browser-runtime-direct",
      visualGrounding: data?.visualGrounding ?? null,
      effect: data?.effect ?? (data?.tab ? {
        tabId: data.tab.id ?? null,
        url: data.tab.url ?? null,
        tabCount: Array.isArray(data.browser?.tabs) ? data.browser.tabs.length : null,
      } : null),
    };
  } catch (error) {
    return {
      registry: leaseContext.registry,
      attempted: true,
      required: leaseContext.required,
      accepted: false,
      status: "unavailable",
      reason: error instanceof Error ? error.message : "browser_action_unavailable",
      leaseMatched: false,
    };
  }
}

async function executeAction(kind, params) {
  const actionId = randomUUID();
  const startedAt = new Date().toISOString();
  const publicParams = kind === "keyboard.type" ? redactWriteOnlyInputParams(params) : params;

  // Audit: Record action started
  await publishEvent(createEventName("screen_act.action_started"), {
    actionId, kind, params: publicParams, startedAt,
  });

  const { screen, degraded } = await getScreenContext();
  let actionDegraded = degraded;
  let mediation = {
    registry: "openclaw-trusted-work-view-action-mediation-v0",
    attempted: false,
    required: false,
    accepted: true,
    status: degraded ? "screen_context_degraded" : "not_applicable",
    reason: degraded ? "screen_context_degraded" : null,
    leaseMatched: false,
  };
  if (!degraded && screen?.focusedWindow?.pid) {
    mediation = await executeBrowserAction(kind, params, screen);
    if (!mediation.accepted) {
      actionDegraded = true;
    }
  }

  const action = {
    id: actionId,
    kind,
    params: publicParams,
    executedAt: new Date().toISOString(),
    screenContext: screen
        ? {
          focusedWindow: screen.focusedWindow,
          sessionId: screen.sessionId,
          readiness: screen.readiness ?? "degraded",
        }
      : null,
    degraded: actionDegraded,
    result: mediation.accepted && mediation.attempted
      ? "executed-browser-runtime"
      : actionDegraded
        ? "blocked-or-degraded"
        : "simulated",
    mediation,
  };

  updateActionState(action);

  // Audit: Record action completed
  await publishEvent(createEventName("screen_act.action_completed"), {
    actionId,
    kind,
    params: publicParams,
    startedAt,
    completedAt: new Date().toISOString(),
    action,
  });

  await publishEvent(createEventName("action.completed"), { action });
  return action;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "openclaw-screen-act",
      stage: "active",
      host,
      port,
      eventHubUrl,
      screenSenseUrl,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/act/state") {
    sendJson(res, 200, {
      ok: true,
      state: { ...actionState },
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/act/mouse/click") {
    // M-4 Fix: Added try/catch consistent with all other routes in this service.
    // Without it, exceptions from readJsonBody or executeAction would leave
    // the HTTP connection hanging with no response.
    try {
      const body = await readJsonBody(req);
      const semanticTarget = body.semanticTarget
        ? normaliseWorkViewSemanticTargetReference(body.semanticTarget)
        : null;
      if (body.semanticTarget && !semanticTarget) {
        throw new Error("Invalid frame-bound semantic target reference.");
      }
      const action = await executeAction("mouse.click", {
        x: semanticTarget ? null : typeof body.x === "number" ? body.x : null,
        y: semanticTarget ? null : typeof body.y === "number" ? body.y : null,
        button: typeof body.button === "string" ? body.button : "left",
        semanticTarget,
      });
      sendJson(res, 200, { ok: true, action });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/act/keyboard/type") {
    // M-4 Fix: Added try/catch consistent with all other routes in this service.
    try {
      const body = await readJsonBody(req);
      const action = await executeAction("keyboard.type", {
        text: typeof body.text === "string" ? body.text : "",
      });
      sendJson(res, 200, { ok: true, action });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/act/browser/new-tab") {
    try {
      const body = await readJsonBody(req);
      const action = await executeAction("browser.new_tab", {
        url: typeof body.url === "string" ? body.url : "",
      });
      sendJson(res, 200, { ok: true, action });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/act/keyboard/hotkey") {
    // M-1 Fix: Added try/catch consistent with all other POST routes.
    try {
      const body = await readJsonBody(req);
      const action = await executeAction("keyboard.hotkey", {
        keys: Array.isArray(body.keys) ? body.keys : [],
      });
      sendJson(res, 200, { ok: true, action });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/act/window/focus") {
    // M-1 Fix: Added try/catch consistent with all other POST routes.
    try {
      const body = await readJsonBody(req);
      const action = await executeAction("window.focus", {
        windowId: typeof body.windowId === "string" ? body.windowId : null,
        title: typeof body.title === "string" ? body.title : null,
      });
      sendJson(res, 200, { ok: true, action });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found." });
});

server.listen(port, host, async () => {
  console.log(`openclaw-screen-act listening on http://${host}:${port}`);
  await registerService(eventHubUrl, "openclaw-screen-act", `http://${host}:${port}`);
  await publishEvent(createEventName("service.started"), {
    service: "openclaw-screen-act",
    url: `http://${host}:${port}`,
  });
});
