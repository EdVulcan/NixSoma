import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerClientAppRefreshersScript } from "../src/client-script-refreshers-app.mjs";

test("Observer task detail renders compact systemd repair receipt evidence", () => {
  for (const token of [
    "Systemd Repair Receipt:",
    "Systemd Repair Target:",
    "Systemd Repair Journal:",
    "Systemd Repair Hostd:",
    "messagesPersisted",
    "receiptHash",
    "Provider Incident Context:",
    "Provider Incident Target:",
    "Provider Incident Journal:",
    "journalMessagesIncluded",
  ]) {
    assert.match(observerClientAppRefreshersScript, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.doesNotMatch(observerClientAppRefreshersScript, /journal\.entries/u);
});

test("generated Observer client remains syntactically valid with repair receipt readback", () => {
  assert.doesNotThrow(() => new Function(`return (async () => {${clientScript()}\n});`));
});
