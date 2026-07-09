import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNativeAcpxCodexLiveExecutionBoundaryReview,
  NATIVE_ACPX_CODEX_LIVE_EXECUTION_BOUNDARY_REVIEW_REGISTRY,
} from "../src/native-acpx-codex-live-execution-boundary-review-builders.mjs";

test("native ACPX/Codex live execution boundary review blocks without preflight", () => {
  const response = buildNativeAcpxCodexLiveExecutionBoundaryReview({
    tasks: new Map(),
  });

  assert.equal(response.ok, true);
  assert.equal(response.registry, NATIVE_ACPX_CODEX_LIVE_EXECUTION_BOUNDARY_REVIEW_REGISTRY);
  assert.equal(response.decision.status, "blocked");
  assert.equal(response.decision.canProceedToLiveSpawn, false);
  assert(response.decision.blockers.includes("missing_completed_process_spawn_preflight"));
  assert.equal(response.governance.canSpawnCodexAcp, false);
});

test("native ACPX/Codex live execution boundary review keeps live spawn blocked after preflight", () => {
  const response = buildNativeAcpxCodexLiveExecutionBoundaryReview({
    taskId: "task-spawn",
    tasks: new Map([["task-spawn", {
      id: "task-spawn",
      status: "completed",
      nativeAcpxCodexBridgeProcessSpawn: {
        execution: {
          registry: "openclaw-native-acpx-codex-bridge-process-spawn-preflight-v0",
          wrapper: {
            relativePath: ".openclaw/acpx/codex-bridge/codex-acp-one.sh",
            exists: true,
            hashMatches: true,
            contentPreviewExposed: false,
          },
          command: {
            commandName: "node",
            argsExposed: false,
            nodeRuntimeAvailable: true,
            commandExecuted: false,
            processSpawned: false,
          },
        },
      },
    }]]),
  });

  assert.equal(response.decision.status, "blocked");
  assert.equal(response.decision.canProceedToLiveSpawn, false);
  assert.equal(response.preflight.taskId, "task-spawn");
  assert.equal(response.preflight.wrapper.hashMatches, true);
  assert.equal(response.preflight.command.commandExecuted, false);
  assert(response.decision.blockers.includes("live_process_spawn_not_authorized"));
  assert(response.decision.blockers.includes("provider_or_network_egress_not_authorized"));
  assert.equal(response.requiredAuthorizations.liveProcessSpawn, false);
  assert.equal(response.governance.canExecuteWrapper, false);
  assert.equal(response.governance.canUseNetwork, false);
});
