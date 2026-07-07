import http from "node:http";
import { randomUUID } from "node:crypto";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

const host = process.env.OPENCLAW_SCREEN_ACT_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OPENCLAW_SCREEN_ACT_PORT ?? "4105", 10);
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const screenSenseUrl = process.env.OPENCLAW_SCREEN_SENSE_URL ?? "http://127.0.0.1:4104";
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

async function executeAction(kind, params) {
  const actionId = randomUUID();
  const startedAt = new Date().toISOString();

  // Audit: Record action started
  await publishEvent(createEventName("screen_act.action_started"), {
    actionId, kind, params, startedAt,
  });

  const { screen, degraded } = await getScreenContext();
  if (!degraded && screen?.focusedWindow?.pid) {
    try {
      if (kind === "mouse.click") {
        await fetch(`${browserRuntimeUrl}/browser/click`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ x: params.x, y: params.y }),
        });
      }

      if (kind === "keyboard.type") {
        await fetch(`${browserRuntimeUrl}/browser/input`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: params.text ?? "" }),
        });
      }
    } catch {
    }
  }

  const action = {
    id: actionId,
    kind,
    params,
    executedAt: new Date().toISOString(),
    screenContext: screen
        ? {
          focusedWindow: screen.focusedWindow,
          sessionId: screen.sessionId,
          readiness: screen.readiness ?? "degraded",
        }
      : null,
    degraded,
    result: degraded ? "simulated-degraded" : "simulated",
  };

  updateActionState(action);

  // Audit: Record action completed
  await publishEvent(createEventName("screen_act.action_completed"), {
    actionId,
    kind,
    params,
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
      const action = await executeAction("mouse.click", {
        x: typeof body.x === "number" ? body.x : null,
        y: typeof body.y === "number" ? body.y : null,
        button: typeof body.button === "string" ? body.button : "left",
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
