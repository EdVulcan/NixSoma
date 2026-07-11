import http from "node:http";

const port = Number.parseInt(process.argv[2] ?? "5843", 10);
const activeUrl = "https://example.com/nix-store-screen-sense";
const sessionId = "nix-store-screen-session";

function send(res, payload) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

function sendStatus(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

http.createServer(async (req, res) => {
  if (req.url === "/session/state") {
    send(res, {
      session: { status: "running", sessionId },
      workView: { status: "ready", visibility: "visible", activeUrl, sessionId },
    });
    return;
  }
  if (req.url === "/browser/state") {
    send(res, {
      browser: {
        running: true,
        browserPid: 4242,
        sessionId,
        activeTitle: "Nix Store Work View",
        activeUrl,
        tabs: [{ id: "store-tab", title: "Nix Store Work View", url: activeUrl }],
        engine: { mode: "simulated", realEngine: false },
      },
    });
    return;
  }
  if (req.url === "/browser/capture") {
    send(res, {
      capture: {
        source: "browser-runtime",
        capturedAt: new Date().toISOString(),
        captureStrategy: "browser-runtime-backed",
        activeTitle: "Nix Store Work View",
        activeUrl,
        tabCount: 1,
        sessionId,
        browserRunning: true,
        snapshotText: "Nix store screen capture",
        focusedWindow: { title: "Nix Store Work View", pid: 4242 },
        windowList: [{ title: "Nix Store Work View", pid: 4242 }],
        ocrBlocks: [{ text: "Nix store screen capture", confidence: 0.99 }],
        workViewSummary: {
          kind: "browser-work-view-summary",
          title: "Nix Store Work View",
          url: activeUrl,
          tabCount: 1,
          visibleTextBlocks: ["Nix store screen capture"],
          recentInteraction: { input: null, click: null },
          summaryText: "Nix store screen-sense fixture",
          engine: { mode: "simulated", realEngine: false },
        },
      },
    });
    return;
  }
  if (req.url === "/screen/current") {
    send(res, {
      ok: true,
      screen: {
        readiness: "ready",
        sessionId,
        focusedWindow: { title: "Nix Store Work View", pid: 4242 },
        trustedSession: {
          sessionIdentity: {
            authority: "openclaw-session-manager",
            authoritativeSessionId: sessionId,
          },
          helperRuntime: {
            registry: "openclaw-trusted-work-view-helper-runtime-v0",
            owner: "openclaw-session-manager",
            status: "active",
            leaseId: "nix-store-screen-lease",
            browserLeaseId: "nix-store-screen-lease",
            leaseMatched: true,
            sessionId,
            workViewId: "nix-store-work-view",
            heartbeatAt: new Date().toISOString(),
            actionAuthority: "active",
          },
        },
      },
    });
    return;
  }
  if (req.method === "POST" && req.url === "/browser/input") {
    const body = await readBody(req);
    const lease = body.trustedHelperLease;
    if (lease?.leaseId !== "nix-store-screen-lease" || lease?.sessionId !== sessionId) {
      sendStatus(res, 409, { ok: false, error: "trusted_helper_lease_mismatch" });
      return;
    }
    send(res, {
      ok: true,
      mediation: {
        registry: "openclaw-trusted-work-view-action-mediation-v0",
        required: true,
        accepted: true,
        status: "accepted",
        sessionId,
        leaseId: lease.leaseId,
        leaseMatched: true,
      },
      inputEvidence: {
        registry: "openclaw-write-only-input-evidence-v0",
        charCount: typeof body.text === "string" ? body.text.length : 0,
        textExposed: false,
      },
    });
    return;
  }
  if (req.method === "POST" && req.url === "/screen/refresh") {
    req.resume();
    send(res, { ok: true });
    return;
  }
  if (req.method === "POST" && ["/services/register", "/events"].includes(req.url)) {
    req.resume();
    send(res, { ok: true });
    return;
  }
  send(res, { ok: true });
}).listen(port, "127.0.0.1");
