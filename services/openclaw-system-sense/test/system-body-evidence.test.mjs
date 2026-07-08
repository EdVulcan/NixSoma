import test from "node:test";
import assert from "node:assert/strict";

import { createSystemBodyEvidence } from "../src/system-body-evidence.mjs";

function createReadyBodyEvidence() {
  return createSystemBodyEvidence({
    buildSystemdDependencyMap: async () => ({
      generatedAt: "2026-01-02T03:04:05.000Z",
      registry: "openclaw-systemd-dependency-map-v0",
      summary: { nodes: 3, edges: 2 },
    }),
    buildHealthTrendSummary: async () => ({
      generatedAt: "2026-01-02T03:04:06.000Z",
      registry: "openclaw-health-trend-summary-v0",
      summary: { samples: 2, degradedServices: 0 },
    }),
    buildRouteAwareNextActionRecommendation: async () => ({
      generatedAt: "2026-01-02T03:04:07.000Z",
      registry: "openclaw-route-aware-next-action-v0",
      recommendation: { action: "observe", priority: "normal" },
    }),
    buildConservativeRecoveryPolicyExplanation: async () => ({
      generatedAt: "2026-01-02T03:04:08.000Z",
      registry: "openclaw-conservative-recovery-policy-v0",
      policy: { currentPosture: "observe_first" },
      rules: [{ id: "no-host-mutation" }],
    }),
    buildBodyGovernanceReadiness: async () => ({
      generatedAt: "2026-01-02T03:04:09.000Z",
      registry: "openclaw-body-governance-readiness-v0",
      summary: { ready: true, passedChecks: 5, totalChecks: 5 },
    }),
    buildPhase2RouteReview: async () => ({
      generatedAt: "2026-01-02T03:04:10.000Z",
      registry: "openclaw-phase-2-route-review-v0",
      decision: { selectedSlice: "openclaw-phase-2-demo-control-room", notSelected: ["no-hidden-mutation"] },
    }),
    buildSystemdRepairCandidateDemoStatus: async () => ({
      generatedAt: "2026-01-02T03:04:11.000Z",
      registry: "openclaw-systemd-repair-candidate-demo-status-v0",
      summary: { demoReady: true, selectedUnit: "openclaw-browser-runtime.service", passedChecks: 5, totalChecks: 5 },
    }),
    fetchNextRepairDemoStatus: async () => ({
      generatedAt: "2026-01-02T03:04:12.000Z",
      registry: "openclaw-systemd-next-repair-demo-status-v0",
      summary: { ready: true, targetUnit: "openclaw-system-sense.service", outcome: "dry_run_only" },
    }),
  });
}

test("system body evidence builds timeline and readiness from injected dependencies", async () => {
  const bodyEvidence = createReadyBodyEvidence();

  const timeline = await bodyEvidence.buildBodyEvidenceTimeline();
  const readiness = await bodyEvidence.buildBodyEvidenceTimelineReadiness();

  assert.equal(timeline.registry, "openclaw-body-evidence-timeline-v0");
  assert.equal(timeline.summary.timelineReady, true);
  assert.equal(timeline.summary.entries, 8);
  assert.equal(timeline.governance.hostMutation, false);
  assert.equal(timeline.entries.at(-1).id, "systemd-next-repair-demo-status");
  assert.equal(readiness.registry, "openclaw-body-evidence-timeline-readiness-v0");
  assert.equal(readiness.summary.ready, true);
  assert.equal(readiness.summary.hiddenMutation, false);
});

test("system body evidence keeps ledger route reviews plan-only before writes", async () => {
  const bodyEvidence = createReadyBodyEvidence();

  const ledgerPlan = await bodyEvidence.buildBodyEvidenceLedgerPlan();
  const routeReview = await bodyEvidence.buildBodyEvidenceLedgerRouteReview();
  const storageRootPlan = await bodyEvidence.buildBodyEvidenceLedgerStorageRootPlan();

  assert.equal(ledgerPlan.summary.planReady, true);
  assert.equal(ledgerPlan.governance.canWriteLedger, false);
  assert.equal(ledgerPlan.governance.durableStorageWritten, false);
  assert.equal(routeReview.decision.selectedSlice, "openclaw-body-evidence-ledger-storage-root-plan");
  assert.equal(routeReview.evidence.durableStorageWritten, false);
  assert.equal(storageRootPlan.summary.selectedDisplayPath, ".artifacts/openclaw-body-evidence-ledger");
  assert.equal(storageRootPlan.summary.directoryCreated, false);
});

test("system body evidence factory rejects missing dependency wiring", () => {
  assert.throws(
    () => createSystemBodyEvidence({}),
    /requires buildSystemdDependencyMap/,
  );
});
