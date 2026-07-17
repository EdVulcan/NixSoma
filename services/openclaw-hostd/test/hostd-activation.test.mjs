import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  HOSTD_ACTIVATION_CAPABILITY_ID,
  HOSTD_ACTIVATION_CAPABILITY_REGISTRY,
  HOSTD_ACTIVATION_OPERATION,
  HOSTD_ACTIVATION_RESPONSE_REGISTRY,
  HOSTD_ACTIVATION_TARGET_PATH,
  validateManagedConfigActivationReceipt,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";
import {
  createManagedConfigActivationRunner,
} from "../src/managed-config-activation.mjs";
import {
  createHostdActivationRequestHandler,
  parseHostdActivationRequest,
} from "../src/hostd-activation-protocol.mjs";
import { createHostdRequestHandler } from "../src/hostd-protocol.mjs";
import { createHostdServer } from "../src/server.mjs";
import { requestHostdManagedConfigActivation } from "../../openclaw-core/src/hostd-control-client.mjs";

const FIXED_NOW = Date.now();
const candidateText = "{ services.openclaw.enable = true; }\n";
const candidateHash = createHash("sha256").update(candidateText, "utf8").digest("hex");
const closurePath = "/nix/store/abc123-openclaw-system";

function request(overrides = {}) {
  return {
    version: 1,
    operation: HOSTD_ACTIVATION_OPERATION,
    target: HOSTD_ACTIVATION_TARGET_PATH,
    stagingPath: "/var/lib/openclaw/managed-config-staging/openclaw-managed-a.nix",
    candidateHash,
    evaluatedClosurePath: closurePath,
    expiresAt: new Date(FIXED_NOW + 60_000).toISOString(),
    requestId: "activation-request-1",
    sourceStagingTaskId: "staging-task-1",
    activationDecisionTaskId: "decision-task-1",
    activationTaskId: "activation-task-1",
    ...overrides,
  };
}

function createFakeRunner({ enabled = true } = {}) {
  const stagingDirectory = "/var/lib/openclaw/managed-config-staging";
  const writes = [];
  const renames = [];
  const commands = [];
  const runner = createManagedConfigActivationRunner({
    enabled,
    stagingDirectory,
    now: () => FIXED_NOW,
    accessImpl: async () => {},
    readFileImpl: async (filePath) => {
      if (filePath.endsWith(`openclaw-managed-${candidateHash}.nix`)) return candidateText;
      throw Object.assign(new Error("not found"), { code: "ENOENT" });
    },
    lstatImpl: async () => {
      throw Object.assign(new Error("not found"), { code: "ENOENT" });
    },
    writeFileImpl: async (filePath, text) => writes.push({ filePath, text }),
    renameImpl: async (from, to) => renames.push({ from, to }),
    execFileImpl: async (executable, args) => {
      commands.push({ executable, args });
      return { stdout: "activation ok", stderr: "" };
    },
  });
  return { runner, writes, renames, commands };
}

test("managed config activation runner binds staging bytes and returns an immutable receipt", async () => {
  const { runner, writes, renames, commands } = createFakeRunner();
  const result = await runner(request({
    stagingPath: `/var/lib/openclaw/managed-config-staging/openclaw-managed-${candidateHash}.nix`,
  }));

  assert.equal(result.status, "passed");
  assert.equal(result.activationExecuted, true);
  assert.equal(result.generationSwitched, true);
  assert.equal(result.rollbackExecuted, false);
  assert.equal(result.candidateHash, candidateHash);
  assert.equal(result.evaluatedClosurePath, closurePath);
  assert.equal(validateManagedConfigActivationReceipt(result), true);
  assert.equal(JSON.stringify(result).includes(candidateText), false);
  assert.equal(writes.length, 1);
  assert.equal(renames[0].to, HOSTD_ACTIVATION_TARGET_PATH);
  assert.deepEqual(commands, [{
    executable: "/run/current-system/sw/bin/nixos-rebuild",
    args: ["switch", "--flake", "/etc/nixos#openclaw-local-dev"],
  }]);
});

test("managed config activation is fail-closed when disabled or candidate bytes change", async () => {
  const disabled = await createFakeRunner({ enabled: false }).runner(request({
    stagingPath: `/var/lib/openclaw/managed-config-staging/openclaw-managed-${candidateHash}.nix`,
  }));
  assert.equal(disabled.status, "failed");
  assert.equal(disabled.activationExecuted, false);
  assert.equal(disabled.error.code, "activation_disabled");
  assert.equal(validateManagedConfigActivationReceipt(disabled), true);

  const mismatch = createManagedConfigActivationRunner({
    enabled: true,
    stagingDirectory: "/var/lib/openclaw/managed-config-staging",
    now: () => FIXED_NOW,
    accessImpl: async () => {},
    readFileImpl: async (filePath) => filePath.endsWith(".nix") ? "tampered" : "",
    lstatImpl: async () => { throw Object.assign(new Error("not found"), { code: "ENOENT" }); },
    writeFileImpl: async () => { throw new Error("must not write"); },
    execFileImpl: async () => { throw new Error("must not execute"); },
  });
  const result = await mismatch(request({
    stagingPath: `/var/lib/openclaw/managed-config-staging/openclaw-managed-${candidateHash}.nix`,
  }));
  assert.equal(result.status, "failed");
  assert.equal(result.activationExecuted, false);
  assert.equal(result.error.code, "candidate_hash_mismatch");
});

test("hostd activation protocol requires peer identity and rejects replay", async () => {
  const { runner } = createFakeRunner();
  const handler = createHostdActivationRequestHandler({
    runActivation: runner,
    now: () => FIXED_NOW,
  });
  const line = JSON.stringify(request({
    stagingPath: `/var/lib/openclaw/managed-config-staging/openclaw-managed-${candidateHash}.nix`,
  }));

  const response = await handler(line, { peerIdentity: { verified: true, matched: true } });
  assert.equal(response.ok, true);
  assert.equal(response.registry, HOSTD_ACTIVATION_RESPONSE_REGISTRY);
  assert.equal(response.capability.capabilityId, HOSTD_ACTIVATION_CAPABILITY_ID);
  assert.equal(response.capability.registry, HOSTD_ACTIVATION_CAPABILITY_REGISTRY);
  assert.equal(validateManagedConfigActivationReceipt(response.receipt), true);

  const replay = await handler(line, { peerIdentity: { verified: true, matched: true } });
  assert.equal(replay.ok, false);
  assert.equal(replay.error.code, "request_replayed");

  const denied = await handler(JSON.stringify(request({ requestId: "activation-request-2" })), {
    peerIdentity: { verified: true, matched: false },
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "peer_identity_denied");
});

test("hostd activation parser rejects target and unknown-field widening", () => {
  const wrongTarget = parseHostdActivationRequest(JSON.stringify(request({ target: "/etc/passwd" })));
  assert.equal(wrongTarget.recognised, true);
  assert.equal(wrongTarget.ok, false);
  assert.equal(wrongTarget.response.error.code, "unsupported_capability");

  const extraField = parseHostdActivationRequest(JSON.stringify(request({ command: "nixos-rebuild" })));
  assert.equal(extraField.recognised, true);
  assert.equal(extraField.ok, false);
  assert.equal(extraField.response.error.code, "unknown_field");
});

test("hostd activation parser bounds JSON work and requires canonical bounded expiry", () => {
  const oversized = parseHostdActivationRequest(`{"operation":"${HOSTD_ACTIVATION_OPERATION}","padding":"${"x".repeat(9000)}"}`);
  assert.equal(oversized.recognised, false);

  for (const expiresAt of [
    "not-a-date",
    new Date(FIXED_NOW + 60_000).toISOString().replace(/\.\d{3}Z$/u, "Z"),
    new Date(FIXED_NOW - 1).toISOString(),
    new Date(FIXED_NOW + 5 * 60_000 + 1_000).toISOString(),
  ]) {
    const parsed = parseHostdActivationRequest(JSON.stringify(request({ expiresAt })));
    assert.equal(parsed.recognised, true);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.response.error.code, "unsupported_capability");
  }
});

test("hostd dispatcher and Core client preserve the activation receipt over Unix socket", async () => {
  const socketPath = path.join(mkdtempSync(path.join(tmpdir(), "openclaw-hostd-activation-")), "hostd.sock");
  const { runner } = createFakeRunner();
  const runtime = createHostdServer({
    socketPath,
    peerVerifier: async () => ({ verified: true, matched: true, reason: null }),
    requestHandler: createHostdRequestHandler({ runActivation: runner }),
  });
  await runtime.listen();
  try {
    const response = await requestHostdManagedConfigActivation({
      socketPath,
      stagingPath: `/var/lib/openclaw/managed-config-staging/openclaw-managed-${candidateHash}.nix`,
      candidateHash,
      evaluatedClosurePath: closurePath,
      requestId: "client-activation-request",
      sourceStagingTaskId: "staging-task-1",
      activationDecisionTaskId: "decision-task-1",
      activationTaskId: "activation-task-1",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    assert.equal(response.ok, true);
    assert.equal(response.receipt.requestId, "client-activation-request");
    assert.equal(response.receipt.activationTaskId, "activation-task-1");
  } finally {
    await runtime.close();
  }
});
