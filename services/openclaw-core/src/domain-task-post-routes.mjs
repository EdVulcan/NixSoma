import { sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";

function confirmInput(body) {
  return { confirm: body.confirm === true };
}

function confirmExecuteInput(body) {
  return {
    confirm: body.confirm === true,
    execute: body.execute === true,
  };
}

function taskIdInput(body) {
  return {
    confirm: body.confirm === true,
    taskId: typeof body.taskId === "string" && body.taskId.trim() ? body.taskId.trim() : null,
  };
}

function routeFieldValue(field, result, { serialiseTask, serialiseApproval }) {
  if (field.kind === "task") {
    return [field.output, serialiseTask(result[field.source])];
  }
  if (field.kind === "approval") {
    const approval = result[field.source];
    return [field.output, approval ? serialiseApproval(approval) : null];
  }
  return [field.output, result[field.source]];
}

const DOMAIN_TASK_ROUTES = [
  {
    path: "/system/systemd/repair-execution-tasks",
    builder: "createSystemdRepairExecutionTask",
    input: (body) => ({
      unit: typeof body.unit === "string" ? body.unit : null,
      confirm: body.confirm === true,
      execute: body.execute === true,
    }),
    fields: ["sourceRegistry", "target", "repairPlan", "dryRunEnvelope", "task", "approval", "governance"],
  },
  {
    path: "/system/systemd/repair-candidate-tasks",
    builder: "createSystemdRepairCandidateTaskShell",
    input: confirmInput,
    fields: ["sourceRegistry", "routeGate", "task", "approval", "governance"],
  },
  {
    path: "/system/systemd/next-repair-tasks",
    builder: "createSystemdNextRepairTaskShell",
    input: confirmExecuteInput,
    fields: ["sourceRegistry", "routeGate", "task", "approval", "governance"],
  },
  {
    path: "/body/evidence-ledger/directory-tasks",
    builder: "createBodyEvidenceLedgerDirectoryTaskShell",
    input: confirmInput,
    fields: ["sourceRegistry", "routeReview", "ledgerDirectory", "task", "approval", "governance"],
  },
  {
    path: "/body/evidence-ledger/first-record-tasks",
    builder: "createBodyEvidenceLedgerFirstRecordTaskShell",
    input: confirmInput,
    fields: ["sourceRegistry", "routeReview", "firstRecord", "task", "approval", "governance"],
  },
  {
    path: "/body/evidence-ledger/followup-record-tasks",
    builder: "createBodyEvidenceLedgerFollowupRecordTaskShell",
    input: confirmInput,
    fields: ["sourceRegistry", "routeReview", "followupRecord", "task", "approval", "governance"],
  },
  {
    path: "/body/evidence-ledger/followup-record-append",
    builder: "armBodyEvidenceLedgerFollowupRecordAppend",
    input: taskIdInput,
    statusCode: 200,
    fields: ["routeReview", "task", { source: "approval", output: "approval", kind: "approval" }, "governance"],
  },
  {
    path: "/long-term-memory/write-tasks",
    builder: "createLongTermMemoryWriteTask",
    input: confirmInput,
    fields: ["sourceRegistry", "routeReview", "proposal", "task", "approval", "governance"],
  },
  {
    path: "/cloud-consciousness/handoff-tasks",
    builder: "createCloudConsciousnessHandoffTask",
    input: confirmInput,
    fields: ["sourceRegistry", "routeReview", "contextPackage", "task", "approval", "governance"],
  },
  {
    path: "/cloud-consciousness/provider-dry-run-tasks",
    builder: "createCloudConsciousnessProviderDryRunTask",
    input: confirmInput,
    fields: ["sourceRegistry", "routeReview", "envelope", "task", "approval", "governance"],
  },
  {
    path: "/cloud-consciousness/real-provider-call-tasks",
    builder: "createCloudConsciousnessProviderCallRehearsalTask",
    input: confirmInput,
    fields: ["sourceRegistry", "routeReview", "requestEnvelope", "task", "approval", "governance"],
  },
];

function normaliseField(field) {
  if (typeof field !== "string") {
    return field;
  }
  if (field === "task") {
    return { source: "task", output: "task", kind: "task" };
  }
  if (field === "approval") {
    return { source: "approval", output: "approval", kind: "approval" };
  }
  return { source: field, output: field, kind: "value" };
}

export async function handleDomainTaskPostRoute({ req, res, requestUrl, planBuilder, serialiseTask, serialiseApproval, buildTaskSummary }) {
  if (req.method !== "POST") {
    return false;
  }

  const route = DOMAIN_TASK_ROUTES.find((candidate) => candidate.path === requestUrl.pathname);
  if (!route) {
    return false;
  }

  try {
    const body = await readJsonBody(req);
    const builder = planBuilder[route.builder];
    const result = await builder(route.input(body));
    const payload = {
      ok: true,
      registry: result.registry,
      mode: result.mode,
      generatedAt: result.generatedAt,
    };
    for (const field of route.fields.map(normaliseField)) {
      const [key, value] = routeFieldValue(field, result, { serialiseTask, serialiseApproval });
      payload[key] = value;
    }
    payload.summary = buildTaskSummary();
    sendJson(res, route.statusCode ?? 201, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendJson(res, 400, { ok: false, error: message });
  }
  return true;
}
