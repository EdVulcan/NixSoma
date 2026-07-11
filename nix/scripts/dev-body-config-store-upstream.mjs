import http from "node:http";

const port = Number.parseInt(process.argv[2] ?? "5843", 10);
const activeUrl = "https://example.com/nix-store-screen-sense";
const sessionId = "nix-store-screen-session";

function send(res, payload) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

http.createServer((req, res) => {
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
  if (req.method === "POST" && ["/services/register", "/events"].includes(req.url)) {
    req.resume();
    send(res, { ok: true });
    return;
  }
  send(res, { ok: true });
}).listen(port, "127.0.0.1");
