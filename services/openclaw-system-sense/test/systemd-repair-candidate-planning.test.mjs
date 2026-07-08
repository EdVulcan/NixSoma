import test from "node:test";
import assert from "node:assert/strict";

import { createSystemdRepairCandidatePlanning } from "../src/systemd-repair-candidate-planning.mjs";

const inventory = {
  registry: "openclaw-systemd-unit-inventory-v0",
  observedAt: "2026-01-02T03:04:05.000Z",
  source: { systemdAvailable: true },
  summary: { total: 3, active: 3 },
  units: [
    {
      key: "eventHub",
      name: "openclaw-event-hub",
      unit: "openclaw-event-hub.service",
      component: "body",
      activeState: "active",
      subState: "running",
    },
    {
      key: "browserRuntime",
      name: "openclaw-browser-runtime",
      unit: "openclaw-browser-runtime.service",
      component: "body",
      activeState: "active",
      subState: "running",
    },
    {
      key: "systemSense",
      name: "openclaw-system-sense",
      unit: "openclaw-system-sense.service",
      component: "body",
      activeState: "active",
      subState: "running",
    },
  ],
};

function createPlanning() {
  return createSystemdRepairCandidatePlanning({
    buildSystemdUnitInventory: async () => inventory,
    buildSystemdDependencyMap: async () => ({
      registry: "openclaw-systemd-dependency-map-v0",
      summary: { nodes: 3, edges: 2 },
      nodes: [
        {
          key: "eventHub",
          name: "openclaw-event-hub",
          unit: "openclaw-event-hub.service",
          component: "body",
          impactClass: "foundational",
          impactRadius: 3,
          dependencyLayer: 0,
        },
        {
          key: "browserRuntime",
          name: "openclaw-browser-runtime",
          unit: "openclaw-browser-runtime.service",
          component: "body",
          impactClass: "medium",
          impactRadius: 1,
          dependencyLayer: 2,
        },
        {
          key: "systemSense",
          name: "openclaw-system-sense",
          unit: "openclaw-system-sense.service",
          component: "body",
          impactClass: "medium",
          impactRadius: 1,
          dependencyLayer: 2,
        },
      ],
    }),
    buildHealthTrendSummary: async () => ({
      registry: "openclaw-health-trend-summary-v0",
      services: [
        { service: "eventHub", samples: 2, offline: 0, latestOk: true, latestStatus: "healthy" },
        { service: "browserRuntime", samples: 2, offline: 0, latestOk: true, latestStatus: "healthy" },
        { service: "systemSense", samples: 2, offline: 0, latestOk: true, latestStatus: "healthy" },
      ],
    }),
    findInventoryUnit: (candidateInventory, unitName) => {
      return candidateInventory.units.find((unit) => unit.unit === unitName) ?? null;
    },
  });
}

test("systemd repair candidate planning selects the existing demo target without mutation", async () => {
  const planning = createPlanning();

  const assessment = await planning.buildSystemdRepairCandidateAssessment();
  const candidatePlan = await planning.buildSystemdRepairCandidatePlan();
  const taskRoute = await planning.buildSystemdRepairCandidateTaskRoute();

  assert.equal(assessment.registry, "openclaw-systemd-repair-candidate-assessment-v0");
  assert.equal(assessment.summary.recommendedUnit, "openclaw-browser-runtime.service");
  assert.equal(assessment.governance.hostMutation, false);
  assert.equal(candidatePlan.registry, "openclaw-systemd-repair-candidate-plan-v0");
  assert.equal(candidatePlan.plan.targetUnit, "openclaw-browser-runtime.service");
  assert.equal(candidatePlan.plan.commandPreviewOnly, true);
  assert.equal(candidatePlan.governance.createsTask, false);
  assert.equal(candidatePlan.governance.executesCommand, false);
  assert.equal(taskRoute.registry, "openclaw-systemd-repair-candidate-task-route-v0");
  assert.equal(taskRoute.routeDecision.existingRouteAvailable, true);
  assert.equal(taskRoute.routeDecision.existingRoute, "openclaw-systemd-repair-execution-task");
});

test("systemd repair candidate readiness and demo status close as read-only evidence", async () => {
  const planning = createPlanning();

  const readiness = await planning.buildSystemdRepairCandidateReadiness();
  const routeReview = await planning.buildSystemdRepairCandidateRouteReview();
  const demoStatus = await planning.buildSystemdRepairCandidateDemoStatus();

  assert.equal(readiness.registry, "openclaw-systemd-repair-candidate-readiness-v0");
  assert.equal(readiness.summary.ready, true);
  assert.equal(readiness.summary.createsTaskNow, false);
  assert.equal(readiness.summary.hostMutation, false);
  assert.equal(routeReview.registry, "openclaw-systemd-repair-candidate-route-review-v0");
  assert.equal(routeReview.decision.selectedSlice, "openclaw-systemd-repair-candidate-demo-status");
  assert.equal(routeReview.governance.executesCommand, false);
  assert.equal(demoStatus.registry, "openclaw-systemd-repair-candidate-demo-status-v0");
  assert.equal(demoStatus.summary.demoReady, true);
  assert.equal(demoStatus.summary.hiddenMutation, false);
  assert.equal(demoStatus.next.recommendedSlice, "openclaw-phase-2-next-capability-route-review");
});

test("systemd repair candidate planning factory rejects missing dependency wiring", () => {
  assert.throws(
    () => createSystemdRepairCandidatePlanning({}),
    /requires buildSystemdUnitInventory/,
  );
});
