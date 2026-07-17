import test from "node:test";
import assert from "node:assert/strict";

import {
  createNativeDeclarativeEvolutionClosureIntegrityReceipt,
  createNativeDeclarativeEvolutionClosureQuery,
  hashNativeDeclarativeEvolutionClosureReceipt,
  validateNativeDeclarativeEvolutionClosureIntegrityReceipt,
} from "../src/native-declarative-evolution-closure-integrity.mjs";

const outputPath = "/nix/store/abc123-openclaw-system";
const derivationPath = "/nix/store/def456-openclaw-system.drv";
const narHash = "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=";

test("closure query re-reads a real Nix output and binds deriver and NAR metadata", async () => {
  let observed = null;
  const query = createNativeDeclarativeEvolutionClosureQuery({
    nixCommand: "nix-test",
    execFileImpl: async (command, args, options) => {
      observed = { command, args, options };
      return {
        stdout: JSON.stringify({
          info: {
            [outputPath.slice("/nix/store/".length)]: {
              deriver: derivationPath.slice("/nix/store/".length),
              narHash,
              narSize: 321,
              references: [outputPath],
            },
          },
        }),
      };
    },
  });

  const result = await query({ storePath: outputPath });

  assert.equal(result.status, "passed");
  assert.equal(result.outputPath, outputPath);
  assert.equal(result.derivationPath, derivationPath);
  assert.equal(result.narHash, narHash);
  assert.equal(result.narSize, 321);
  assert.equal(result.referenceCount, 1);
  assert.equal(observed.command, "nix-test");
  assert.deepEqual(observed.args, [
    "--extra-experimental-features",
    "nix-command flakes",
    "path-info",
    "--json-format",
    "2",
    "--json",
    outputPath,
  ]);
  assert.equal(observed.options.timeout, 30_000);
});

test("closure integrity receipt is tamper-evident and approval-bound", () => {
  const receipt = createNativeDeclarativeEvolutionClosureIntegrityReceipt({
    issuedAt: "2026-07-18T00:00:00.000Z",
    sourceStagingTaskId: "task-staging",
    approval: {
      id: "approval-staging",
      taskId: "task-staging",
      status: "approved",
      policyDecisionId: "policy-1",
      binding: { kind: "native_declarative_evolution_candidate", candidateHash: "a".repeat(64) },
    },
    candidateHash: "a".repeat(64),
    candidateBytes: 12,
    stagedFileHash: "b".repeat(64),
    stagedFileBytes: 12,
    evaluatedClosurePath: outputPath,
    closure: {
      status: "passed",
      mode: "nix-path-info",
      derivationPath,
      narHash,
      narSize: 321,
    },
  });

  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(validateNativeDeclarativeEvolutionClosureIntegrityReceipt(receipt), true);
  assert.equal(receipt.receiptHash, hashNativeDeclarativeEvolutionClosureReceipt(receipt));
  assert.equal(validateNativeDeclarativeEvolutionClosureIntegrityReceipt({
    ...receipt,
    narHash: "sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb=",
  }), false);
  assert.equal(JSON.stringify(receipt).includes("candidateText"), false);
});

test("closure query fails closed for an output with no derivation or NAR hash", async () => {
  const query = createNativeDeclarativeEvolutionClosureQuery({
    execFileImpl: async () => ({
      stdout: JSON.stringify({
        info: {
          "abc123-openclaw-system": { narSize: 1 },
        },
      }),
    }),
  });

  const result = await query({ storePath: outputPath });
  assert.equal(result.status, "failed");
  assert.equal(result.reason, "nix_path_info_derivation_missing");
});
