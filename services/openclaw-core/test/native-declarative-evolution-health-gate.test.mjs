import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createNativeDeclarativeEvolutionHealthGateBuilders,
} from "../src/native-declarative-evolution-health-gate.mjs";
import {
  NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE,
} from "../src/native-declarative-evolution-task-builders.mjs";

function hash(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function completedTask({ candidateHash, candidateBytes, stagingPath }) {
  return {
    id: "task-staging",
    type: NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE,
    status: "completed",
    approval: { requestId: "approval-staging" },
    nativeDeclarativeEvolution: {
      candidate: {
        candidateHash,
        candidateBytes,
        target: { path: "/etc/nixos/openclaw-managed.nix" },
      },
      approvalBinding: { candidateHash },
      execution: {
        status: "passed",
        candidateHash,
        staging: {
          status: "staged",
          path: stagingPath,
          candidateHash,
          candidateBytes,
        },
        validation: { status: "passed", mode: "nix-instantiate" },
        evaluation: {
          status: "passed",
          mode: "nix-eval",
          toplevelPath: "/nix/store/abc123-openclaw-system",
        },
        build: { status: "passed", mode: "nix-build-no-link", outputPath: "/nix/store/abc123-openclaw-system" },
        governance: {
          writesManagedConfig: false,
          switchesGeneration: false,
          executesRollback: false,
        },
      },
    },
  };
}

test("declarative evolution health gate verifies the staged file and evaluated closure without assessing host health", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openclaw-declarative-health-gate-test-"));
  const candidateText = "{ lib, ... }: { services.openclaw.components = lib.mkAfter [ \"core\" ]; }\n";
  const candidateHash = hash(candidateText);
  const stagingPath = path.join(root, `openclaw-managed-${candidateHash}.nix`);
  const task = completedTask({
    candidateHash,
    candidateBytes: Buffer.byteLength(candidateText, "utf8"),
    stagingPath,
  });
  const tasks = new Map([["task-staging", task]]);
  const approvals = new Map([["approval-staging", {
    id: "approval-staging",
    taskId: "task-staging",
    status: "approved",
    binding: { kind: "native_declarative_evolution_candidate", candidateHash },
  }]]);

  try {
    await writeFile(stagingPath, candidateText, "utf8");
    const { buildNativeDeclarativeEvolutionHealthGate } = createNativeDeclarativeEvolutionHealthGateBuilders({
      tasks,
      approvals,
      stagingDirectory: root,
      queryClosureIntegrity: async ({ storePath }) => ({
        status: "passed",
        mode: "test-query",
        outputPath: storePath,
        derivationPath: "/nix/store/def456-openclaw-system.drv",
        narHash: "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=",
        narSize: 123,
      }),
      now: () => "2026-07-17T00:00:00.000Z",
    });

    const result = await buildNativeDeclarativeEvolutionHealthGate({ taskId: "task-staging" });

    assert.equal(result.ok, true);
    assert.equal(result.blocked, false);
    assert.equal(result.assessment.status, "eligible_for_activation_review");
    assert.equal(result.assessment.eligibleForActivationReview, true);
    assert.equal(result.assessment.hostHealth, "not_assessed");
    assert.equal(result.staging.fileHash, candidateHash);
    assert.equal(result.evaluatedClosure.path, "/nix/store/abc123-openclaw-system");
    assert.equal(result.evaluatedClosure.derivationPath, "/nix/store/def456-openclaw-system.drv");
    assert.equal(result.closureIntegrity.status, "verified");
    assert.match(result.closureIntegrity.receipt.receiptHash, /^[a-f0-9]{64}$/);
    assert.equal(result.closureIntegrity.receipt.approvalId, "approval-staging");
    assert.equal(result.governance.readsCurrentApprovalRecord, true);
    assert.equal(result.governance.requeriesStoreOutput, true);
    assert.equal(result.governance.emitsImmutableClosureReceipt, true);
    assert.equal(result.governance.writesManagedConfig, false);
    assert.equal(result.governance.switchesGeneration, false);
    assert.equal(result.governance.executesRollback, false);
    assert.equal(result.governance.assessesHostHealth, false);
    assert.equal(result.governance.automaticActivation, false);
    assert.equal(result.governance.automaticRollback, false);
    assert.equal(JSON.stringify(result).includes(candidateText), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("declarative evolution health gate blocks a staged-file hash mismatch and missing task", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openclaw-declarative-health-gate-mismatch-"));
  const candidateText = "{ lib, ... }: { services.openclaw.components = lib.mkAfter [ \"core\" ]; }\n";
  const candidateHash = hash(candidateText);
  const stagingPath = path.join(root, `openclaw-managed-${candidateHash}.nix`);
  const task = completedTask({
    candidateHash,
    candidateBytes: Buffer.byteLength(candidateText, "utf8"),
    stagingPath,
  });
  const tasks = new Map([["task-staging", task]]);
  const approvals = new Map([["approval-staging", {
    id: "approval-staging",
    taskId: "task-staging",
    status: "approved",
    binding: { kind: "native_declarative_evolution_candidate", candidateHash },
  }]]);

  try {
    await writeFile(stagingPath, "tampered", "utf8");
    const { buildNativeDeclarativeEvolutionHealthGate } = createNativeDeclarativeEvolutionHealthGateBuilders({
      tasks,
      approvals,
      stagingDirectory: root,
      queryClosureIntegrity: async ({ storePath }) => ({
        status: "passed",
        mode: "test-query",
        outputPath: storePath,
        derivationPath: "/nix/store/def456-openclaw-system.drv",
        narHash: "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=",
        narSize: 123,
      }),
    });

    const mismatch = await buildNativeDeclarativeEvolutionHealthGate({ taskId: "task-staging" });
    assert.equal(mismatch.ok, true);
    assert.equal(mismatch.assessment.status, "blocked");
    assert.equal(mismatch.assessment.eligibleForActivationReview, false);
    assert.ok(mismatch.failedChecks.includes("stagingFileHashMatches"));
    assert.ok(mismatch.failedChecks.includes("stagingFileBytesMatch"));

    const missing = await buildNativeDeclarativeEvolutionHealthGate({ taskId: "missing" });
    assert.equal(missing.ok, false);
    assert.equal(missing.blocked, true);
    assert.equal(missing.reason, "staging_task_not_found");
    assert.equal(missing.governance.automaticActivation, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("declarative evolution health gate refuses /etc/nixos staging ownership", () => {
  assert.throws(
    () => createNativeDeclarativeEvolutionHealthGateBuilders({ stagingDirectory: "/etc/nixos" }),
    /outside \/etc\/nixos/,
  );
});
