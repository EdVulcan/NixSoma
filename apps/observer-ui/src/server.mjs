import http from "node:http";
import { getOpenClawServicePort, getOpenClawServiceUrl } from "../../../packages/shared-client/src/service-descriptors.mjs";
import { clientScript } from "./client-script.mjs";
import { observerHtml } from "./observer-html.mjs";

const host = process.env.OBSERVER_UI_HOST ?? "127.0.0.1";
const port = getOpenClawServicePort("observerUi");
const coreUrl = getOpenClawServiceUrl("core");
const eventHubUrl = getOpenClawServiceUrl("eventHub");
const sessionManagerUrl = getOpenClawServiceUrl("sessionManager");
const screenSenseUrl = getOpenClawServiceUrl("screenSense");
const screenActUrl = getOpenClawServiceUrl("screenAct");
const systemSenseUrl = getOpenClawServiceUrl("systemSense");
const systemHealUrl = getOpenClawServiceUrl("systemHeal");

function sendHtml(res, html) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
  });
  res.end(html);
}

function sendJavaScript(res, script) {
  res.writeHead(200, {
    "content-type": "text/javascript; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
  });
  res.end(script);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
  });
  res.end(JSON.stringify(payload, null, 2));
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "observer-ui",
      stage: "active",
      coreUrl,
      eventHubUrl,
      sessionManagerUrl,
      screenSenseUrl,
      screenActUrl,
      systemSenseUrl,
      systemHealUrl,
    });
    return;
  }

  if (req.method === "GET" && (requestUrl.pathname === "/client.js" || requestUrl.pathname === "/client-v5.js")) {
    sendJavaScript(res, clientScript());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/") {
    sendHtml(res, observerHtml());
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found." });
});

server.listen(port, host, () => {
  console.log(`observer-ui listening on http://${host}:${port}`);
});
