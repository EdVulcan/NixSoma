import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  HOSTD_ROLLBACK_CAPABILITY_ID,
  HOSTD_ROLLBACK_CAPABILITY_REGISTRY,
  HOSTD_ROLLBACK_HELPER_RECEIPT_REGISTRY,
  HOSTD_ROLLBACK_OPERATION,
  HOSTD_ROLLBACK_RESPONSE_REGISTRY,
  HOSTD_ROLLBACK_TARGET_PATH,
  validateManagedConfigRollbackReceipt,
} from "../../../packages/shared-systemd/src/openclaw-hostd-rollback.mjs";
import { createManagedConfigRollbackRunner } from "../src/managed-config-rollback.mjs";
import { createHostdRollbackRequestHandler, parseHostdRollbackRequest } from "../src/hostd-rollback-protocol.mjs";
import { createHostdRequestHandler } from "../src/hostd-protocol.mjs";
import { createHostdServer } from "../src/server.mjs";
import { requestHostdManagedConfigRollback } from "../../openclaw-core/src/hostd-control-client.mjs";

const FIXED_NOW = Date.now();
const candidateHash = "a".repeat(64);
const activationReceiptHash = "b".repeat(64);
const previousGenerationPath = "/nix/store/old123-nixos-system-nixos-test";
const activatedGenerationPath = "/nix/store/new123-nixos-system-nixos-test";

function request(overrides = {}) {
  return {
    version: 1,
    operation: HOSTD_ROLLBACK_OPERATION,
    target: HOSTD_ROLLBACK_TARGET_PATH,
    requestId: "rollback-request-1",
    expiresAt: new Date(FIXED_NOW + 60_000).toISOString(),
    activationTaskId: "activation-task-1",
    rollbackTaskId: "rollback-task-1",
    activationReceiptHash,
    rollbackSnapshotId: "activation-request-1",
    candidateHash,
    previousGenerationPath,
    activatedGenerationPath,
    previousTargetPresent: false,
    previousTargetHash: null,
    ...overrides,
  };
}

function createFakeRunner({ enabled = true } = {}) {
  const commands = [];
  const runner = createManagedConfigRollbackRunner({
    enabled,
    rollbackHelper: "/nix/store/helper/bin/nixsoma-managed-config-rollback",
    sudoExecutable: "/run/wrappers/bin/sudo",
    now: () => FIXED_NOW,
    execFileImpl: async (executable, args) => {
      commands.push({ executable, args });
      return {
        stdout: JSON.stringify({
          registry: HOSTD_ROLLBACK_HELPER_RECEIPT_REGISTRY,
          rollbackSnapshotId: args.at(-1),
          candidateHash,
          generationBefore: activatedGenerationPath,
          profileBefore: activatedGenerationPath,
          generationAfter: previousGenerationPath,
          profileAfter: previousGenerationPath,
          targetHashBefore: candidateHash,
          previousTargetPresent: false,
          previousTargetHash: null,
          targetPresentAfter: false,
          targetHashAfter: null,
          rollbackExecuted: true,
          snapshotConsumed: true,
        }),
        stderr: "",
      };
    },
  });
  return { runner, commands };
}

test("managed config rollback runner invokes only the fixed snapshot helper and returns an immutable receipt", async () => {
  const { runner, commands } = createFakeRunner();
  const result = await runner(request());

  assert.equal(result.status, "passed");
  assert.equal(result.rollbackExecuted, true);
  assert.equal(result.generationRestored, true);
  assert.equal(result.snapshotConsumed, true);
  assert.equal(result.activationReceiptHash, activationReceiptHash);
  assert.equal(result.previousGenerationPath, previousGenerationPath);
  assert.equal(result.activatedGenerationPath, activatedGenerationPath);
  assert.equal(validateManagedConfigRollbackReceipt(result), true);
  const reordered = Object.fromEntries(Object.entries({
    ...result,
    helperEvidence: Object.fromEntries(Object.entries(result.helperEvidence).reverse()),
  }).reverse());
  assert.equal(validateManagedConfigRollbackReceipt(reordered), true);
  assert.deepEqual(commands, [{
    executable: "/run/wrappers/bin/sudo",
    args: ["--non-interactive", "/nix/store/helper/bin/nixsoma-managed-config-rollback", "activation-request-1"],
  }]);

  const tampered = { ...result, previousGenerationPath: "/nix/store/other-nixos-system-nixos-test" };
  assert.equal(validateManagedConfigRollbackReceipt(tampered), false);
});

test("managed config rollback fails closed when disabled or receipt bindings are inconsistent", async () => {
  const disabled = await createFakeRunner({ enabled: false }).runner(request());
  assert.equal(disabled.status, "failed");
  assert.equal(disabled.rollbackExecuted, false);
  assert.equal(disabled.error.code, "rollback_disabled");
  assert.equal(validateManagedConfigRollbackReceipt(disabled), true);

  const invalid = await createFakeRunner().runner(request({ previousTargetPresent: true }));
  assert.equal(invalid.status, "failed");
  assert.equal(invalid.error.code, "binding_rejected");
});

test("hostd rollback protocol requires peer identity and rejects request replay", async () => {
  const { runner } = createFakeRunner();
  const handler = createHostdRollbackRequestHandler({ runRollback: runner, now: () => FIXED_NOW });
  const line = JSON.stringify(request());

  const response = await handler(line, { peerIdentity: { verified: true, matched: true } });
  assert.equal(response.ok, true);
  assert.equal(response.registry, HOSTD_ROLLBACK_RESPONSE_REGISTRY);
  assert.equal(response.capability.capabilityId, HOSTD_ROLLBACK_CAPABILITY_ID);
  assert.equal(response.capability.registry, HOSTD_ROLLBACK_CAPABILITY_REGISTRY);
  assert.equal(validateManagedConfigRollbackReceipt(response.receipt), true);

  const replay = await handler(line, { peerIdentity: { verified: true, matched: true } });
  assert.equal(replay.ok, false);
  assert.equal(replay.error.code, "request_replayed");

  const denied = await handler(JSON.stringify(request({ requestId: "rollback-request-2" })), {
    peerIdentity: { verified: true, matched: false },
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "peer_identity_denied");
});

test("hostd rollback parser rejects path, generation, command, and expiry widening", () => {
  for (const overrides of [
    { target: "/etc/passwd" },
    { previousGenerationPath: "/etc/passwd" },
    { activatedGenerationPath: previousGenerationPath },
    { previousTargetPresent: true },
    { expiresAt: new Date(FIXED_NOW + 10 * 60_000).toISOString() },
  ]) {
    const parsed = parseHostdRollbackRequest(JSON.stringify(request(overrides)));
    assert.equal(parsed.recognised, true);
    assert.equal(parsed.ok, false);
  }
  const command = parseHostdRollbackRequest(JSON.stringify(request({ command: "nixos-rebuild" })));
  assert.equal(command.response.error.code, "unknown_field");
});

test("hostd dispatcher and Core client preserve the rollback receipt over Unix socket", async () => {
  const socketPath = path.join(mkdtempSync(path.join(tmpdir(), "openclaw-hostd-rollback-")), "hostd.sock");
  const { runner } = createFakeRunner();
  const runtime = createHostdServer({
    socketPath,
    peerVerifier: async () => ({ verified: true, matched: true, reason: null }),
    requestHandler: createHostdRequestHandler({ runRollback: runner }),
  });
  await runtime.listen();
  try {
    const response = await requestHostdManagedConfigRollback({
      socketPath,
      requestId: "client-rollback-request",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      activationTaskId: "activation-task-1",
      rollbackTaskId: "rollback-task-1",
      activationReceiptHash,
      rollbackSnapshotId: "activation-request-1",
      candidateHash,
      previousGenerationPath,
      activatedGenerationPath,
      previousTargetPresent: false,
      previousTargetHash: null,
    });
    assert.equal(response.ok, true);
    assert.equal(response.receipt.requestId, "client-rollback-request");
    assert.equal(response.receipt.rollbackTaskId, "rollback-task-1");
  } finally {
    await runtime.close();
  }
});
