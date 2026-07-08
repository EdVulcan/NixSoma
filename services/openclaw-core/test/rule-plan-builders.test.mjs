import test from "node:test";
import assert from "node:assert/strict";

import { createRulePlanBuilders } from "../src/rule-plan-builders.mjs";

function createRulePlanHarness() {
  const capabilities = new Map([
    ["act.work_view.control", {
      id: "act.work_view.control",
      name: "Work view control",
      kind: "act",
      service: "session-manager",
      risk: "low",
      governance: "audit_only",
    }],
    ["act.browser.open", {
      id: "act.browser.open",
      name: "Open browser",
      kind: "act",
      service: "browser-runtime",
      risk: "low",
      governance: "audit_only",
    }],
    ["sense.screen.observe", {
      id: "sense.screen.observe",
      name: "Observe screen",
      kind: "sense",
      service: "screen-sense",
      risk: "low",
      governance: "audit_only",
    }],
    ["act.screen.pointer_keyboard", {
      id: "act.screen.pointer_keyboard",
      name: "Pointer and keyboard",
      kind: "act",
      service: "screen-act",
      risk: "medium",
      governance: "require_approval",
      requiresApproval: true,
    }],
    ["act.filesystem.append_text", {
      id: "act.filesystem.append_text",
      name: "Append text",
      kind: "act",
      service: "system-sense",
      risk: "medium",
      governance: "require_approval",
    }],
    ["operate.task.loop", {
      id: "operate.task.loop",
      name: "Task loop",
      kind: "operate",
      service: "openclaw-core",
      risk: "low",
      governance: "audit_only",
    }],
    ["boundary.cross_domain.approval", {
      id: "boundary.cross_domain.approval",
      name: "Cross-domain approval",
      kind: "govern",
      service: "openclaw-core",
      risk: "critical",
      governance: "require_approval",
      requiresApproval: true,
    }],
  ]);

  return createRulePlanBuilders({
    CROSS_BOUNDARY_INTENTS: new Set(["provider.egress"]),
    capabilityById: (id) => capabilities.get(id) ?? null,
    capabilityByIntent: (intent) => intent === "custom.lookup"
      ? {
          id: "sense.screen.observe",
        }
      : null,
  });
}

test("rule plan builders annotate capability-aware plans and redact public params", () => {
  const builders = createRulePlanHarness();

  const plan = builders.buildRulePlan({
    goal: "write evidence",
    targetUrl: "http://127.0.0.1:4101",
    policy: {
      intent: "task.execute",
    },
    actions: [
      {
        kind: "filesystem.append",
        params: {
          content: "secret body memory",
          path: "/tmp/openclaw-memory.jsonl",
        },
      },
      {
        kind: "network.request",
        intent: "provider.egress",
        params: {
          body: "secret request",
        },
      },
    ],
  });
  const publicPlan = builders.serialisePlanForPublic(plan);

  assert.equal(plan.strategy, "rule-v1");
  assert.equal(plan.planner, "capability-aware-v1");
  assert.equal(plan.intent, "task.execute");
  assert.ok(plan.planId.startsWith("plan-"));
  assert.ok(plan.capabilitySummary.ids.includes("act.filesystem.append_text"));
  assert.ok(plan.capabilitySummary.ids.includes("boundary.cross_domain.approval"));
  assert.equal(plan.capabilitySummary.approvalGates >= 2, true);
  assert.equal(publicPlan.steps[3].params.content, "[redacted:18 bytes]");
  assert.equal(publicPlan.steps[4].params.body, "[redacted:14 bytes]");
  assert.equal(publicPlan.steps[3].params.path, "/tmp/openclaw-memory.jsonl");
});

test("rule plan builders preserve default planning and build decision contracts", () => {
  const builders = createRulePlanHarness();

  const plan = builders.buildRulePlan({
    goal: "default task",
    targetUrl: null,
    actions: [],
    type: "system.command",
  });

  assert.equal(builders.shouldBuildPlan({ includePlan: true }), true);
  assert.equal(builders.shouldBuildPlan({ planStrategy: "rule-v1" }), true);
  assert.equal(builders.shouldBuildPlan({ executionMode: "planned" }), true);
  assert.equal(builders.shouldBuildPlan({}), false);
  assert.equal(plan.steps.some((step) => step.kind === "keyboard.type"), true);
  assert.equal(plan.steps.some((step) => step.kind === "mouse.click"), true);
});

test("rule plan builders update phase status without task lifecycle coupling", () => {
  const builders = createRulePlanHarness();
  const task = {
    plan: {
      status: "planned",
      steps: [
        {
          phase: "opening_target",
          status: "pending",
        },
        {
          phase: "completed",
          status: "pending",
        },
      ],
    },
  };

  builders.updatePlanForPhase(task, "opening_target", { ok: true });
  assert.equal(task.plan.status, "running");
  assert.equal(task.plan.steps[0].status, "completed");
  assert.deepEqual(task.plan.steps[0].details, { ok: true });

  builders.updatePlanForPhase(task, "completed");
  assert.equal(task.plan.status, "completed");
  assert.equal(task.plan.steps[1].status, "completed");

  builders.updatePlanForPhase(task, "failed", { reason: "blocked" });
  assert.equal(task.plan.status, "failed");
  assert.deepEqual(task.plan.failure, { reason: "blocked" });
});
