import test from "node:test";
import assert from "node:assert/strict";

import {
  createNativeDeclarativeEvolutionBuilders,
  NATIVE_DECLARATIVE_EVOLUTION_REGISTRY,
  NATIVE_DECLARATIVE_EVOLUTION_TARGET,
} from "../src/native-declarative-evolution-builders.mjs";

test("declarative evolution builder emits an allowlisted managed Nix candidate", async () => {
  const validations = [];
  const { buildNativeDeclarativeEvolutionCandidate } = createNativeDeclarativeEvolutionBuilders({
    validateCandidate: async (candidateText) => {
      validations.push(candidateText);
      return { status: "passed", mode: "test-validator", resultType: "set" };
    },
  });

  const result = await buildNativeDeclarativeEvolutionCandidate({
    changes: [
      { operation: "enable_kernel_event_capture", durationMs: 800, maxEvents: 32 },
      { operation: "enable_component", component: "systemSense" },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.registry, NATIVE_DECLARATIVE_EVOLUTION_REGISTRY);
  assert.equal(result.candidateStatus, "validated");
  assert.equal(result.target.path, NATIVE_DECLARATIVE_EVOLUTION_TARGET);
  assert.equal(result.validation.status, "passed");
  assert.equal(result.governance.writesManagedConfig, false);
  assert.equal(result.governance.switchesGeneration, false);
  assert.equal(result.governance.executesRollback, false);
  assert.equal(result.next.automaticStage, false);
  assert.equal(validations.length, 1);
  assert.match(result.candidateText, /services\.openclaw\.components = lib\.mkAfter/);
  assert.match(result.candidateText, /"systemSense"/);
  assert.match(result.candidateText, /durationMs = 800;/);
  assert.match(result.candidateText, /maxEvents = 32;/);
  assert.equal(result.candidateText.includes("nixos-rebuild"), false);
});

test("declarative evolution builder fails closed for unknown operations and raw fields", async () => {
  const { buildNativeDeclarativeEvolutionCandidate } = createNativeDeclarativeEvolutionBuilders({
    validateCandidate: async () => ({ status: "passed", mode: "test-validator", resultType: "set" }),
  });

  await assert.rejects(
    () => buildNativeDeclarativeEvolutionCandidate({
      changes: [{ operation: "write_raw_nix", content: "{ dangerous = true; }" }],
    }),
    /not allowlisted/,
  );
  await assert.rejects(
    () => buildNativeDeclarativeEvolutionCandidate({
      changes: [{ operation: "enable_component", component: "systemSense", rawNix: "dangerous" }],
    }),
    /unsupported field/,
  );
  await assert.rejects(
    () => buildNativeDeclarativeEvolutionCandidate({
      changes: [{ operation: "enable_component", component: "sshd" }],
    }),
    /not allowlisted/,
  );
});

test("declarative evolution builder reports unavailable or failed validation as blocked", async () => {
  const unavailable = createNativeDeclarativeEvolutionBuilders({
    validateCandidate: async () => ({ status: "unavailable", mode: "nix-instantiate" }),
  });
  const unavailableResult = await unavailable.buildNativeDeclarativeEvolutionCandidate({
    changes: [{ operation: "enable_component", component: "systemSense" }],
  });
  assert.equal(unavailableResult.ok, true);
  assert.equal(unavailableResult.candidateStatus, "blocked");
  assert.equal(unavailableResult.validation.status, "unavailable");
  assert.equal(unavailableResult.next.recommendedAction, "fix_candidate_validation");

  const failed = createNativeDeclarativeEvolutionBuilders({
    validateCandidate: async () => ({ status: "failed", mode: "nix-instantiate", reason: "syntax" }),
  });
  const failedResult = await failed.buildNativeDeclarativeEvolutionCandidate({
    changes: [{ operation: "set_kernel_event_capture_limits", durationMs: 1, maxEvents: 1 }],
  });
  assert.equal(failedResult.candidateStatus, "blocked");
  assert.equal(failedResult.validation.reason, "syntax");
});
