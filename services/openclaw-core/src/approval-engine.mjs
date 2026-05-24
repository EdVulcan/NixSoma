import { randomUUID } from "node:crypto";

export function createApprovalEngine(deps) {
  const { state, taskManager } = deps;
  const { approvals, APPROVAL_TTL_MS, policyAuditLog, MAX_POLICY_AUDIT_ENTRIES, persistState } = state;
  const { serialiseTask, tasks } = taskManager;

  // L10041-10298
function serialiseApproval(approval) {
  return {
    id: approval.id,
    status: approval.status,
    taskId: approval.taskId ?? null,
    policyDecisionId: approval.policyDecisionId ?? null,
    intent: approval.intent ?? null,
    domain: approval.domain ?? null,
    risk: approval.risk ?? null,
    decision: approval.decision ?? null,
    reason: approval.reason ?? null,
    requestedBy: approval.requestedBy ?? "openclaw-core",
    approvedBy: approval.approvedBy ?? null,
    deniedBy: approval.deniedBy ?? null,
    resolutionReason: approval.resolutionReason ?? null,
    expiresAt: approval.expiresAt ?? null,
    createdAt: approval.createdAt,
    updatedAt: approval.updatedAt,
    resolvedAt: approval.resolvedAt ?? null,
    expiredAt: approval.expiredAt ?? null,
    task: approval.taskId && tasks.has(approval.taskId) ? serialiseTask(tasks.get(approval.taskId)) : null,
  };
}

function listApprovals() {
  reconcileApprovalExpirations();
  return [...approvals.values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .map((approval) => serialiseApproval(approval));
}

function buildApprovalSummary() {
  reconcileApprovalExpirations();
  const counts = {
    total: 0,
    pending: 0,
    approved: 0,
    denied: 0,
    expired: 0,
  };

  for (const approval of approvals.values()) {
    counts.total += 1;
    counts[approval.status] = (counts[approval.status] ?? 0) + 1;
  }

  const pending = [...approvals.values()]
    .filter((approval) => approval.status === "pending")
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  return {
    counts,
    pendingCount: pending.length,
    latestPendingId: pending[0]?.id ?? null,
  };
}

function getApprovalExpiresAt(approval) {
  if (typeof approval.expiresAt === "string" && approval.expiresAt.trim()) {
    return approval.expiresAt;
  }

  if (!APPROVAL_TTL_MS || typeof approval.createdAt !== "string") {
    return null;
  }

  const createdAtMs = Date.parse(approval.createdAt);
  if (Number.isNaN(createdAtMs)) {
    return null;
  }

  return new Date(createdAtMs + APPROVAL_TTL_MS).toISOString();
}

function isApprovalExpired(approval, nowMs = Date.now()) {
  const expiresAt = getApprovalExpiresAt(approval);
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  return !Number.isNaN(expiresAtMs) && expiresAtMs <= nowMs;
}

function markApprovalExpired(approval, { reason = "Approval expired." } = {}) {
  const now = new Date().toISOString();
  approval.status = "expired";
  approval.resolutionReason = reason;
  approval.resolvedAt = now;
  approval.expiredAt = now;
  approval.updatedAt = now;

  const task = approval.taskId ? getTaskById(approval.taskId) : null;
  if (task) {
    task.approval = {
      requestId: approval.id,
      status: approval.status,
      required: false,
      updatedAt: now,
    };
    if (isActiveTask(task)) {
      failTask(task, reason, {
        approvalId: approval.id,
        reason,
      });
    } else {
      persistState();
    }
  } else {
    persistState();
  }

  return { approval, task };
}

function reconcileApprovalExpirations() {
  if (!APPROVAL_TTL_MS) {
    return [];
  }

  const nowMs = Date.now();
  const expired = [];
  for (const approval of approvals.values()) {
    if (approval.status === "pending" && isApprovalExpired(approval, nowMs)) {
      expired.push(markApprovalExpired(approval));
    }
  }
  return expired;
}

function findExistingApprovalForTask(taskId) {
  return [...approvals.values()]
    .filter((approval) => approval.taskId === taskId && ["pending", "approved"].includes(approval.status))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
}

function createApprovalRequestForTask(task, decision) {
  const existing = findExistingApprovalForTask(task.id);
  if (existing) {
    task.approval = {
      requestId: existing.id,
      status: existing.status,
      required: existing.status === "pending",
      updatedAt: existing.updatedAt,
    };
    return existing;
  }

  const now = new Date().toISOString();
  const approval = {
    id: randomUUID(),
    status: "pending",
    taskId: task.id,
    policyDecisionId: decision.id,
    intent: decision.subject?.intent ?? null,
    domain: decision.domain,
    risk: decision.risk,
    decision: decision.decision,
    reason: decision.reason,
    requestedBy: "openclaw-core",
    expiresAt: APPROVAL_TTL_MS ? new Date(Date.parse(now) + APPROVAL_TTL_MS).toISOString() : null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    expiredAt: null,
  };
  approvals.set(approval.id, approval);
  task.approval = {
    requestId: approval.id,
    status: approval.status,
    required: true,
    updatedAt: approval.updatedAt,
  };

  if (approvals.size > MAX_APPROVAL_ITEMS) {
    const removable = [...approvals.values()]
      .filter((item) => item.status !== "pending")
      .sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt))[0];
    if (removable) {
      approvals.delete(removable.id);
    }
  }

  persistState();
  return approval;
}

function markApprovalApproved(approval, { approvedBy = "user", reason = "Approved by user." } = {}) {
  const now = new Date().toISOString();
  approval.status = "approved";
  approval.approvedBy = approvedBy;
  approval.resolutionReason = reason;
  approval.resolvedAt = now;
  approval.updatedAt = now;

  const task = approval.taskId ? getTaskById(approval.taskId) : null;
  if (task) {
    task.policy = {
      request: {
        ...(task.policy?.request ?? {}),
        approved: true,
      },
      decision: task.policy?.decision ?? null,
    };
    task.approval = {
      requestId: approval.id,
      status: approval.status,
      required: false,
      updatedAt: now,
    };
    ensureTaskPolicy(task, { stage: "approval.approved", force: true });
  }

  persistState();
  return { approval, task };
}

function markApprovalDenied(approval, { deniedBy = "user", reason = "Denied by user." } = {}) {
  const now = new Date().toISOString();
  approval.status = "denied";
  approval.deniedBy = deniedBy;
  approval.resolutionReason = reason;
  approval.resolvedAt = now;
  approval.updatedAt = now;

  const task = approval.taskId ? getTaskById(approval.taskId) : null;
  if (task) {
    task.approval = {
      requestId: approval.id,
      status: approval.status,
      required: false,
      updatedAt: now,
    };
    if (isActiveTask(task)) {
      failTask(task, "Approval denied by user.", {
        approvalId: approval.id,
        reason,
      });
    } else {
      persistState();
    }
  } else {
    persistState();
  }

  return { approval, task };
}

async function publishTaskApprovalIfPending(task) {
  const approval = task?.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  if (approval?.status === "pending") {
    await publishEvent("approval.created", {
      approval: serialiseApproval(approval),
      task: serialiseTask(task),
    });
  }
}


  return {
    serialiseApproval,
    listApprovals,
    buildApprovalSummary,
    markApprovalExpired,
    reconcileApprovalExpirations,
    findExistingApprovalForTask,
    createApprovalRequestForTask,
    markApprovalApproved,
    markApprovalDenied,
    publishTaskApprovalIfPending,
  };
}
