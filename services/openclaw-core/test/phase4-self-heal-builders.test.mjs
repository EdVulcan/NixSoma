import test from "node:test";
import assert from "node:assert/strict";

import { createPhase4SelfHealBuilders } from "../src/phase4-self-heal-builders.mjs";

function createPhase4Harness(overrides = {}) {
  const fetchUrls = [];
  const latestRun = overrides.latestRun ?? {
    id: "maintenance-run-1",
    engine: "maintenance-v0",
    status: "healthy",
    autonomy: "conservative",
    executed: [],
    skipped: [
      {
        action: "observe-only",
        status: "skipped",
      },
    ],
    diagnosis: {
      status: "healthy",
      plan: {
        stepCount: 1,
      },
      source: {
        hostname: "openclaw-dev",
      },
    },
  };
  const responses = {
    "http://127.0.0.1:4106/system/health": {
      ok: true,
      system: {
        services: Object.fromEntries(
          Array.from({ length: 7 }, (_, index) => [
            `openclaw-service-${index}`,
            { unit: `openclaw-service-${index}.service` },
          ]),
        ),
      },
    },
    "http://127.0.0.1:4107/heal/state": {
      ok: true,
      engine: "system-heal-v0",
      historyCount: 1,
      capabilities: {
        diagnose: true,
        autoFix: true,
        maintenance: true,
      },
      latestDiagnosis: latestRun.diagnosis,
    },
    "http://127.0.0.1:4107/heal/history": {
      ok: true,
      count: 1,
      items: [
        {
          id: "heal-history-1",
          status: "skipped",
        },
      ],
    },
    "http://127.0.0.1:4107/maintenance/state": {
      ok: true,
      runCount: 1,
      latestRun,
    },
    "http://127.0.0.1:4107/maintenance/history?limit=8": {
      ok: true,
      count: 1,
      items: [
        {
          id: latestRun.id,
          status: latestRun.status,
        },
      ],
    },
    ...(overrides.responses ?? {}),
  };
  const builders = createPhase4SelfHealBuilders({
    systemSenseUrl: "http://127.0.0.1:4106",
    systemHealUrl: "http://127.0.0.1:4107",
    fetchJson: async (url) => {
      fetchUrls.push(url);
      if (overrides.rejectUrls?.includes(url)) {
        throw new Error(`blocked ${url}`);
      }
      return responses[url] ?? {};
    },
  });
  return { builders, fetchUrls };
}

test("phase 4 self-heal builders preserve plan and service evidence contracts", async () => {
  const { builders, fetchUrls } = createPhase4Harness();

  const plan = await builders.buildPhase4Plan();
  const loop = await builders.buildPhase4SelfHealLoop();
  const history = await builders.buildPhase4HealHistoryEvidence();

  assert.equal(plan.registry, "openclaw-phase-4-plan-v0");
  assert.equal(plan.summary.ready, true);
  assert.equal(plan.next.recommendedSlice, "openclaw-phase-4-self-heal-loop");
  assert.equal(loop.registry, "openclaw-phase-4-self-heal-loop-v0");
  assert.equal(loop.summary.ready, true);
  assert.equal(loop.summary.servicesObserved, 7);
  assert.equal(loop.summary.realHostRepair, false);
  assert.equal(loop.maintenance.latestRunId, "maintenance-run-1");
  assert.equal(history.registry, "openclaw-phase-4-heal-history-evidence-v0");
  assert.equal(history.summary.ready, true);
  assert.equal(history.history.latestRunId, "maintenance-run-1");
  assert.deepEqual(fetchUrls.slice(0, 5), [
    "http://127.0.0.1:4106/system/health",
    "http://127.0.0.1:4107/heal/state",
    "http://127.0.0.1:4107/heal/history",
    "http://127.0.0.1:4107/maintenance/state",
    "http://127.0.0.1:4107/maintenance/history?limit=8",
  ]);
});

test("phase 4 self-heal builders close readiness and exit without mutation", async () => {
  const { builders } = createPhase4Harness();

  const readiness = await builders.buildPhase4CompletionReadiness();
  const exit = await builders.buildPhase4Exit();

  assert.equal(readiness.registry, "openclaw-phase-4-completion-readiness-v0");
  assert.equal(readiness.summary.ready, true);
  assert.equal(readiness.summary.completionPercent, 100);
  assert.equal(readiness.governance.mutatesHost, false);
  assert.equal(exit.registry, "openclaw-phase-4-exit-v0");
  assert.equal(exit.summary.complete, true);
  assert.equal(exit.next.recommendedSlice, "openclaw-phase-5-plan");
});

test("phase 4 self-heal builders preserve fallback read models when heal services are unreachable", async () => {
  const { builders } = createPhase4Harness({
    rejectUrls: [
      "http://127.0.0.1:4107/heal/state",
      "http://127.0.0.1:4107/maintenance/state",
    ],
  });

  const loop = await builders.buildPhase4SelfHealLoop();

  assert.equal(loop.registry, "openclaw-phase-4-self-heal-loop-v0");
  assert.equal(loop.summary.ready, false);
  assert.equal(loop.evidence.healState.ok, false);
  assert.equal(loop.evidence.maintenanceState.ok, false);
  assert.equal(loop.governance.realHostRepair, false);
});
