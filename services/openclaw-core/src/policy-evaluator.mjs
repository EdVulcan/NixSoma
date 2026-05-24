import { randomUUID } from "node:crypto";

export function createPolicyEvaluator(deps) {
  const { state, createApprovalRequestForTask } = deps;
  const { policyAuditLog, MAX_POLICY_AUDIT_ENTRIES, persistState, autonomyMode, DENIED_INTENTS, CROSS_BOUNDARY_INTENTS, approvals } = state;

  // L19008-19239
function normalisePolicyTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((tag) => typeof tag === "string" && tag.trim())
    .map((tag) => tag.trim());
}

function inferPolicyIntent(input = {}) {
  const policy = input.policy && typeof input.policy === "object" ? input.policy : {};
  const action = input.action && typeof input.action === "object" ? input.action : {};
  const rawIntent =
    policy.intent
    ?? input.intent
    ?? action.intent
    ?? action.kind
    ?? input.actionKind
    ?? input.kind
    ?? input.type
    ?? "task.execute";

  return typeof rawIntent === "string" && rawIntent.trim() ? rawIntent.trim() : "task.execute";
}

function inferPolicyDomain({ input, intent, tags }) {
  const policy = input.policy && typeof input.policy === "object" ? input.policy : {};
  const explicitDomain = typeof policy.domain === "string" && policy.domain.trim()
    ? policy.domain.trim()
    : typeof input.domain === "string" && input.domain.trim()
      ? input.domain.trim()
      : null;

  if (explicitDomain) {
    return explicitDomain;
  }

  if (
    policy.crossBoundary === true
    || input.crossBoundary === true
    || CROSS_BOUNDARY_INTENTS.has(intent)
    || tags.includes("cross_boundary")
    || tags.includes("external")
    || tags.includes("data_egress")
  ) {
    return "cross_boundary";
  }

  if (
    intent.startsWith("heal.")
    || intent.startsWith("system.")
    || intent.startsWith("body.")
    || input.type === "system_task"
    || input.type === "heal_task"
  ) {
    return "body_internal";
  }

  return "user_task";
}

function inferPolicyRisk({ input, intent, domain, tags }) {
  const policy = input.policy && typeof input.policy === "object" ? input.policy : {};
  const explicitRisk = typeof policy.risk === "string" && policy.risk.trim()
    ? policy.risk.trim()
    : typeof input.risk === "string" && input.risk.trim()
      ? input.risk.trim()
      : null;

  if (explicitRisk) {
    return explicitRisk;
  }

  if (DENIED_INTENTS.has(intent) || tags.includes("destructive")) {
    return "critical";
  }

  if (domain === "cross_boundary") {
    return "high";
  }

  if (intent.startsWith("heal.") || intent.startsWith("system.")) {
    return "medium";
  }

  return "low";
}

function evaluatePolicyIntent(input = {}, context = {}) {
  const policy = input.policy && typeof input.policy === "object" ? input.policy : {};
  const tags = [...normalisePolicyTags(input.tags), ...normalisePolicyTags(policy.tags)];
  const intent = inferPolicyIntent(input);
  const domain = inferPolicyDomain({ input, intent, tags });
  const risk = inferPolicyRisk({ input, intent, domain, tags });
  const approved = policy.approved === true || input.approved === true || context.approved === true;
  const requiresApproval = policy.requiresApproval === true || input.requiresApproval === true;
  const auditRequired = domain !== "user_task" || risk !== "low" || policy.audit === true || input.audit === true;
  const bodyAutonomyAllowed = autonomyMode !== "guardian" && domain === "body_internal";
  const crossBoundaryAutonomyAllowed = autonomyMode === "full_autonomy" && domain === "cross_boundary";

  let decision = "allow";
  let reason = "within_user_task_boundary";

  if (DENIED_INTENTS.has(intent) || policy.deny === true || input.deny === true) {
    decision = "deny";
    reason = "absolute_boundary";
  } else if (domain === "cross_boundary" && !approved && !crossBoundaryAutonomyAllowed) {
    decision = "require_approval";
    reason = "cross_boundary_requires_user_approval";
  } else if (requiresApproval && !approved && !bodyAutonomyAllowed && !crossBoundaryAutonomyAllowed) {
    decision = "require_approval";
    reason = "approval_required";
  } else if (auditRequired) {
    decision = "audit_only";
    reason = approved
      ? "approved_and_audited"
      : requiresApproval && bodyAutonomyAllowed
        ? "body_sovereignty_autonomy"
        : requiresApproval && crossBoundaryAutonomyAllowed
          ? "full_autonomy_audit"
          : "body_internal_audit";
  }

  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    at: now,
    engine: "policy-v0",
    stage: context.stage ?? "evaluate",
    subject: {
      taskId: input.taskId ?? context.taskId ?? null,
      type: input.type ?? context.type ?? null,
      goal: input.goal ?? context.goal ?? null,
      targetUrl: input.targetUrl ?? context.targetUrl ?? null,
      intent,
    },
    domain,
    risk,
    decision,
    reason,
    approved,
    autonomyMode,
    autonomous: (requiresApproval && !approved && (bodyAutonomyAllowed || crossBoundaryAutonomyAllowed)) === true,
    auditRequired,
    tags,
  };
}

function recordPolicyDecision(decision) {
  policyAuditLog.push(decision);
  if (policyAuditLog.length > MAX_POLICY_AUDIT_ENTRIES) {
    policyAuditLog.splice(0, policyAuditLog.length - MAX_POLICY_AUDIT_ENTRIES);
  }
  persistState();
  return decision;
}

function isPolicyExecutionAllowed(decision) {
  return decision?.decision === "allow" || decision?.decision === "audit_only";
}

function buildPolicyState() {
  return {
    engine: "policy-v0",
    mode: "local-rule-governance",
    autonomyMode,
    rules: {
      bodyInternalDefault: "allow_with_audit",
      userTaskDefault: "allow",
      crossBoundaryDefault: "require_approval",
      bodyInternalAutonomy: autonomyMode === "guardian" ? "approval_gated" : "autonomous_with_audit",
      crossBoundaryAutonomy: autonomyMode === "full_autonomy" ? "autonomous_with_audit" : "approval_gated",
      deniedIntents: [...DENIED_INTENTS],
      crossBoundaryIntents: [...CROSS_BOUNDARY_INTENTS],
    },
    decisions: policyAuditLog.slice(-20).reverse(),
    counts: policyAuditLog.reduce((counts, decision) => {
      counts.total += 1;
      counts[decision.decision] = (counts[decision.decision] ?? 0) + 1;
      counts[decision.domain] = (counts[decision.domain] ?? 0) + 1;
      return counts;
    }, {
      total: 0,
      allow: 0,
      audit_only: 0,
      require_approval: 0,
      deny: 0,
      body_internal: 0,
      user_task: 0,
      cross_boundary: 0,
    }),
  };
}

function ensureTaskPolicy(task, context = {}) {
  const existing = task.policy?.decision ? task.policy : null;
  if (existing && context.force !== true) {
    return existing;
  }

  const decision = evaluatePolicyIntent({
    taskId: task.id,
    type: task.type,
    goal: task.goal,
    targetUrl: task.targetUrl,
    policy: task.policy?.request ?? task.policy ?? {},
  }, {
    stage: context.stage ?? "task",
    taskId: task.id,
    type: task.type,
    goal: task.goal,
    targetUrl: task.targetUrl,
  });
  task.policy = {
    request: task.policy?.request ?? task.policy ?? {},
    decision,
  };
  recordPolicyDecision(decision);
  if (decision.decision === "require_approval") {
    createApprovalRequestForTask(task, decision);
  } else if (task.approval?.requestId) {
    const approval = approvals.get(task.approval.requestId);
    task.approval = {
      requestId: task.approval.requestId,
      status: approval?.status ?? task.approval.status ?? "resolved",
      required: false,
      updatedAt: approval?.updatedAt ?? new Date().toISOString(),
    };
  }
  return task.policy;
}

  return {
    normalisePolicyTags,
    inferPolicyIntent,
    inferPolicyDomain,
    inferPolicyRisk,
    evaluatePolicyIntent,
    recordPolicyDecision,
    isPolicyExecutionAllowed,
    buildPolicyState,
    ensureTaskPolicy,
  };
}
