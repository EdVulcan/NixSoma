import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerClientConfigDomSystemBodyScript } from "../src/client-script-config-dom-system-body.mjs";
import { observerClientSystemdRefreshersScript } from "../src/client-script-refreshers-systemd.mjs";
import { observerClientRuntimeBindingsScript } from "../src/client-script-runtime-bindings.mjs";
import { OBSERVER_STARTUP_INITIAL_REFRESH_NAMES } from "../src/client-script-startup-refreshes.mjs";
import { observerSystemPanels } from "../src/observer-panels-system.mjs";

test("Observer exposes bounded boot and restart evidence without journal entries", () => {
  for (const token of [
    "systemd-boot-evidence-panel",
    "systemd-boot-evidence-current",
    "systemd-boot-evidence-previous",
    "systemd-boot-evidence-assessment",
    "refresh-systemd-boot-evidence-button",
    "systemd-boot-evidence-json",
  ]) {
    assert.equal(observerSystemPanels().includes(token), true, `panel is missing ${token}`);
  }

  for (const token of [
    "systemdBootEvidenceCurrent",
    "systemdBootEvidencePrevious",
    "systemdBootEvidenceAssessment",
    "refreshSystemdBootEvidence",
    "/system/systemd/boot-evidence",
    "messagesIncluded",
    "persistentEvidence",
  ]) {
    assert.equal(
      [observerClientConfigDomSystemBodyScript, observerClientSystemdRefreshersScript, observerClientRuntimeBindingsScript]
        .some((script) => script.includes(token)),
      true,
      `Observer client is missing ${token}`,
    );
  }
  assert.equal(OBSERVER_STARTUP_INITIAL_REFRESH_NAMES.includes("refreshSystemdBootEvidence"), true);
  const bootRefresherStart = observerClientSystemdRefreshersScript.indexOf("async function refreshSystemdBootEvidence");
  const bootRefresherEnd = observerClientSystemdRefreshersScript.indexOf("async function refreshSystemdRepairPlan");
  const bootRefresher = observerClientSystemdRefreshersScript.slice(bootRefresherStart, bootRefresherEnd);
  assert.doesNotMatch(bootRefresher, /data\.entries/u);
});

test("generated Observer client remains syntactically valid with boot evidence readback", () => {
  assert.doesNotThrow(() => new Function(`return (async () => {${clientScript()}\n});`));
});
