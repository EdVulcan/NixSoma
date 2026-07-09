import test from "node:test";
import assert from "node:assert/strict";

import { createNativeAcpxCodexBridgeBuilders } from "../src/native-acpx-codex-bridge-builders.mjs";

function createHarness() {
  const events = [];
  let persistCount = 0;
  const state = {
    acpxBridgeSessionRecords: new Map(),
    MAX_ACPX_BRIDGE_SESSION_RECORDS: 100,
    persistState: () => {
      persistCount += 1;
    },
  };
  const builders = createNativeAcpxCodexBridgeBuilders({
    state,
    publishEvent: async (name, body) => {
      events.push({ name, body });
    },
  });
  return { builders, events, persistCount: () => persistCount };
}

test("native ACPX/Codex bridge compatibility reports credential and execution boundaries", () => {
  const { builders } = createHarness();

  const evidence = builders.buildNativeAcpxCodexBridgeCompatibility({
    sessionKey: "agent:codex:missing",
  });

  assert.equal(evidence.registry, "openclaw-native-acpx-codex-bridge-compatibility-v0");
  assert.equal(evidence.compatibility.posixCommand, "npx");
  assert.equal(evidence.compatibility.windowsCommandLesson, "npx.cmd");
  assert.equal(evidence.authIsolation.authJsonRead, false);
  assert.equal(evidence.authIsolation.credentialValueRead, false);
  assert.equal(evidence.governance.canPersistSessionMetadata, true);
  assert.equal(evidence.governance.canReadCredentialValue, false);
  assert.equal(evidence.governance.canWriteWrapper, false);
  assert.equal(evidence.governance.canSpawnCodexAcp, false);
  assert.equal(evidence.persistence.missingSessionReturnsNull, true);
  assert.equal(evidence.persistence.selectedRecord, null);
});

test("native ACPX/Codex session metadata persistence supports independent sessions and overwrite", async () => {
  const { builders, events, persistCount } = createHarness();

  await assert.rejects(
    () => builders.recordNativeAcpxCodexSession({ sessionKey: "agent:codex:one" }),
    /confirm=true/,
  );

  const first = await builders.recordNativeAcpxCodexSession({
    sessionKey: "agent:codex:one",
    recordId: "record-one",
    metadata: { purpose: "first", authToken: "must-not-leak" },
    confirm: true,
  });
  const second = await builders.recordNativeAcpxCodexSession({
    sessionKey: "agent:codex:two",
    recordId: "record-two",
    metadata: { purpose: "second" },
    confirm: true,
  });
  const overwritten = await builders.recordNativeAcpxCodexSession({
    sessionKey: "agent:codex:one",
    recordId: "record-one-updated",
    metadata: { purpose: "updated", secret: "still-not-leaked" },
    confirm: true,
  });
  const evidence = builders.buildNativeAcpxCodexBridgeCompatibility({
    sessionKey: "agent:codex:one",
  });

  assert.equal(first.summary.created, true);
  assert.equal(second.summary.created, true);
  assert.equal(overwritten.summary.overwritten, true);
  assert.equal(overwritten.session.revision, 2);
  assert.equal(overwritten.session.acpxRecordId, "record-one-updated");
  assert.equal(overwritten.session.metadata.secret, "[redacted-key]");
  assert.equal(evidence.persistence.totalRecords, 2);
  assert.equal(evidence.persistence.selectedRecord.acpxRecordId, "record-one-updated");
  assert.equal(evidence.persistence.supportsIndependentSessions, true);
  assert.equal(evidence.persistence.supportsOverwrite, true);
  assert.equal(persistCount(), 3);
  assert.equal(events.filter((event) => event.name === "acpx_codex.session_recorded").length, 3);
});

test("native ACPX/Codex session metadata rejects traversal-like keys", async () => {
  const { builders } = createHarness();

  await assert.rejects(
    () => builders.recordNativeAcpxCodexSession({
      sessionKey: "../codex",
      confirm: true,
    }),
    /sessionKey/,
  );
});
