import assert from "node:assert/strict";
import test from "node:test";

import { observerClientMvpPhaseRefreshersScript } from "../src/client-script-refreshers-mvp-phases.mjs";
import { observerClientRuntimeRefreshersScript } from "../src/client-script-refreshers-runtime.mjs";

test("Observer renders bounded Level 4 graphical-session evidence", () => {
  for (const token of [
    "AI Graphical Session:",
    "aiGraphicalSession.status",
    "aiGraphicalSession.ready",
    "aiGraphicalSession.socket?.name",
    "aiGraphicalSession.boundary?.parentDisplayConnected",
    "aiGraphicalSession.boundary?.inputAuthority",
  ]) {
    assert.equal(
      observerClientRuntimeRefreshersScript.includes(token)
        || observerClientMvpPhaseRefreshersScript.includes(token),
      true,
      `Observer graphical-session readback is missing ${token}`,
    );
  }

  for (const token of [
    "AI Graphical Socket:",
    "AI Graphical Boundary:",
    "aiGraphicalSession.boundary?.readsPixels",
    "aiGraphicalSession.boundary?.browserAttached",
    "aiGraphicalSession.browserAttachment?.status",
    "aiGraphicalSession.browserAttachment?.headed",
  ]) {
    assert.equal(observerClientRuntimeRefreshersScript.includes(token), true);
  }
});
