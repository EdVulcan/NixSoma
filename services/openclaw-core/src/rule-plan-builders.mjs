import { randomUUID } from "node:crypto";

function redactPublicParams(params) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return params ?? {};
  }
  const redacted = { ...params };
  for (const key of ["content", "body", "data"]) {
    if (typeof redacted[key] === "string") {
      redacted[key] = `[redacted:${Buffer.byteLength(redacted[key], "utf8")} bytes]`;
    }
  }
  return redacted;
}

function normalisePlanActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return [
      { kind: "keyboard.type", params: { text: "hello from openclaw-planner" } },
      { kind: "mouse.click", params: { x: 640, y: 360, button: "left" } },
    ];
  }

  return actions
    .filter((action) => action && typeof action === "object")
    .map((action) => ({
      kind: typeof action.kind === "string" && action.kind.trim() ? action.kind.trim() : "mouse.click",
      intent: typeof action.intent === "string" && action.intent.trim() ? action.intent.trim() : null,
      params: action.params && typeof action.params === "object" ? action.params : {},
      when: action.when && typeof action.when === "object" ? action.when : null,
      onFailure: typeof action.onFailure === "string" && action.onFailure.trim() ? action.onFailure.trim() : null,
    }));
}

function inferPlannerIntent({ intent, policy, type }) {
  const policyIntent = policy && typeof policy === "object" && typeof policy.intent === "string"
    ? policy.intent.trim()
    : "";
  const explicitIntent = typeof intent === "string" ? intent.trim() : "";
  const explicitType = typeof type === "string" ? type.trim() : "";
  return policyIntent || explicitIntent || explicitType || "task.execute";
}

function shouldBuildPlan(body) {
  return body.includePlan === true
    || body.plan === true
    || body.planStrategy === "rule-v1"
    || body.executionMode === "planned";
}

function updatePlanForPhase(task, phase, details = null) {
  if (!task.plan || !Array.isArray(task.plan.steps)) {
    return;
  }

  const now = new Date().toISOString();
  task.plan.status = phase === "failed" ? "failed" : phase === "completed" ? "completed" : "running";
  task.plan.updatedAt = now;
  if (phase === "failed") {
    task.plan.failure = details ?? null;
  }

  const step = task.plan.steps.find((candidate) => candidate.phase === phase && candidate.status !== "completed");
  if (step) {
    step.status = phase === "failed" ? "failed" : "completed";
    step.completedAt = now;
    step.details = details;
  }

  if (phase === "completed") {
    for (const candidate of task.plan.steps) {
      if (candidate.status === "pending") {
        candidate.status = "skipped";
      }
    }
  }
}

export function createRulePlanBuilders(deps) {
  const {
    CROSS_BOUNDARY_INTENTS,
    capabilityById,
    capabilityByIntent,
  } = deps;

  function serialisePlanForPublic(plan) {
    if (!plan || typeof plan !== "object") {
      return plan ?? null;
    }
    return {
      ...plan,
      steps: Array.isArray(plan.steps)
        ? plan.steps.map((step) => ({
            ...step,
            params: redactPublicParams(step.params),
          }))
        : plan.steps,
    };
  }

  function resolvePlanCapabilityId({ kind, intent, plannerIntent }) {
    const candidate = intent || kind || plannerIntent || "";
    const directMap = {
      "work_view.prepare": "act.work_view.control",
      "work_view.reveal": "act.work_view.control",
      "work_view.hide": "act.work_view.control",
      "browser.open": "act.browser.open",
      "network.navigate": "act.browser.open",
      "screen.observe": "sense.screen.observe",
      "keyboard.type": "act.screen.pointer_keyboard",
      "keyboard.hotkey": "act.screen.pointer_keyboard",
      "mouse.click": "act.screen.pointer_keyboard",
      "result.verify": "sense.screen.observe",
      "task.complete": "operate.task.loop",
      "policy.evaluate": "govern.policy.evaluate",
      "approval.gate": "govern.policy.evaluate",
    };

    if (directMap[candidate]) {
      return directMap[candidate];
    }
    if (candidate === "filesystem.mkdir" || candidate === "filesystem.directory.create") {
      return "act.filesystem.mkdir";
    }
    if (candidate === "filesystem.append" || candidate === "filesystem.append_text" || candidate === "filesystem.append-text") {
      return "act.filesystem.append_text";
    }
    if (candidate === "filesystem.write" || candidate === "filesystem.write_text" || candidate === "filesystem.write-text") {
      return "act.filesystem.write_text";
    }
    if (candidate.startsWith("filesystem.")) {
      return "sense.filesystem.read";
    }
    if (candidate.startsWith("process.")) {
      return "sense.process.list";
    }
    if (candidate === "command.execute" || candidate === "system.command.execute") {
      return "act.system.command.execute";
    }
    if (candidate === "command.plan" || candidate === "system.command" || candidate.startsWith("system.command.")) {
      return "act.system.command.dry_run";
    }
    if (candidate.startsWith("heal.") || candidate === "system.repair") {
      return "act.system.heal";
    }
    if (CROSS_BOUNDARY_INTENTS.has(candidate)) {
      return "boundary.cross_domain.approval";
    }

    const matchedCapability = capabilityByIntent(candidate);
    return matchedCapability?.id ?? "govern.policy.evaluate";
  }

  function annotatePlanStepWithCapability(step, plannerIntent) {
    const capabilityId = resolvePlanCapabilityId({
      kind: step.kind,
      intent: step.intent,
      plannerIntent,
    });
    const capability = capabilityById(capabilityId);
    if (!capability) {
      return step;
    }

    const requiresApproval = capability.requiresApproval === true || capability.governance === "require_approval";
    return {
      ...step,
      capabilityId: capability.id,
      capability: {
        id: capability.id,
        name: capability.name,
        kind: capability.kind,
        service: capability.service,
      },
      risk: capability.risk,
      governance: capability.governance,
      requiresApproval,
    };
  }

  function summarisePlanCapabilities(steps) {
    const byId = new Map();
    for (const step of steps) {
      if (!step.capabilityId) {
        continue;
      }
      if (!byId.has(step.capabilityId)) {
        byId.set(step.capabilityId, {
          id: step.capabilityId,
          risk: step.risk ?? "unknown",
          governance: step.governance ?? "unknown",
          requiresApproval: step.requiresApproval === true,
          stepCount: 0,
        });
      }
      const entry = byId.get(step.capabilityId);
      entry.stepCount += 1;
      entry.requiresApproval = entry.requiresApproval || step.requiresApproval === true;
    }

    return {
      total: byId.size,
      ids: [...byId.keys()],
      items: [...byId.values()],
      approvalGates: [...byId.values()].filter((capability) => capability.requiresApproval).length,
    };
  }

  function buildRulePlan({ goal, targetUrl, actions, type, intent, policy }) {
    const now = new Date().toISOString();
    const plannerIntent = inferPlannerIntent({ intent, policy, type });
    const actionSteps = normalisePlanActions(actions).map((action, index) => ({
      id: `step-action-${index + 1}`,
      kind: action.kind,
      intent: action.intent ?? action.kind,
      phase: "acting_on_target",
      title: `Perform ${action.kind}`,
      status: "pending",
      params: action.params,
      when: action.when,
      onFailure: action.onFailure,
    }));

    const steps = [
      {
        id: "step-prepare-work-view",
        kind: "work_view.prepare",
        phase: "preparing_work_view",
        title: "Prepare the AI work view",
        status: "pending",
      },
      {
        id: "step-open-target",
        kind: "browser.open",
        phase: "opening_target",
        title: `Open ${targetUrl ?? "the target URL"}`,
        status: "pending",
      },
      {
        id: "step-observe-screen",
        kind: "screen.observe",
        phase: "observing_screen",
        title: "Observe the current screen state",
        status: "pending",
      },
      ...actionSteps,
      {
        id: "step-verify-result",
        kind: "result.verify",
        phase: "verifying_result",
        title: "Verify the task result",
        status: "pending",
      },
      {
        id: "step-close-task",
        kind: "task.complete",
        phase: "completed",
        title: "Close the task after verification",
        status: "pending",
      },
    ].map((step) => annotatePlanStepWithCapability(step, plannerIntent));

    return {
      planId: `plan-${randomUUID()}`,
      strategy: "rule-v1",
      planner: "capability-aware-v1",
      capabilityAware: true,
      status: "planned",
      goal,
      targetUrl,
      intent: plannerIntent,
      createdAt: now,
      updatedAt: now,
      capabilitySummary: summarisePlanCapabilities(steps),
      steps,
    };
  }

  return {
    serialisePlanForPublic,
    buildRulePlan,
    shouldBuildPlan,
    updatePlanForPhase,
  };
}
