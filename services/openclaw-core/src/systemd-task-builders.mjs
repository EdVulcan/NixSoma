import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

export function createSystemdTaskBuilders(deps) {
  const {
    fetchJson,
    systemSenseUrl,
    evaluatePolicyIntent,
    createTask,
    createApprovalRequestForTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    publishEvent,
    publishTaskApprovalIfPending,
    serialiseTask,
    serialisePlanForPublic,
    SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
    SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY,
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY,
    SYSTEMD_REPAIR_REAL_EXECUTION_UNIT,
    SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT,
    SYSTEMD_REPAIR_RESTART_HELPER,
    SYSTEMD_REPAIR_AUTH_DELEGATION,
  } = deps;

  function normaliseSystemdRepairUnit(value) {
    const unit = typeof value === "string" && value.trim()
      ? value.trim()
      : "openclaw-browser-runtime.service";
    return unit.endsWith(".service") ? unit : `${unit}.service`;
  }

  async function buildSystemdRepairExecutionTaskDraft({ unit = null, execute = false } = {}) {
    const targetUnit = normaliseSystemdRepairUnit(unit);
    const realExecution = execute === true;
    if (realExecution && targetUnit !== SYSTEMD_REPAIR_REAL_EXECUTION_UNIT) {
      throw new Error(`Real systemd repair execution is limited to ${SYSTEMD_REPAIR_REAL_EXECUTION_UNIT}.`);
    }
    const dryRunEnvelope = await fetchJson(`${systemSenseUrl}/system/systemd/repair-dry-run?unit=${encodeURIComponent(targetUnit)}`);
    const plan = dryRunEnvelope.plan;
    const command = dryRunEnvelope.dryRun;
    const goal = realExecution
      ? `Operator-reviewed real systemd repair execution for ${targetUnit}`
      : `Operator-reviewed systemd repair execution task for ${targetUnit}`;
    const policyRequest = {
      intent: "systemd.repair.execute",
      domain: "body_internal",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["systemd", "repair", "host_mutation_candidate", "operator_reviewed"],
    };
    const policyDecision = evaluatePolicyIntent({
      type: "systemd_repair_execution_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "systemd_repair_execution_task.draft",
      type: "systemd_repair_execution_task",
      goal,
    });

    return {
      registry: SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
      mode: realExecution ? "operator-reviewed-real-execution-task-draft" : "operator-reviewed-execution-task-draft",
      generatedAt: new Date().toISOString(),
      sourceRegistry: dryRunEnvelope.registry,
      target: dryRunEnvelope.target,
      repairPlan: plan,
      dryRunEnvelope,
      draft: {
        goal,
        type: "systemd_repair_execution_task",
        workViewStrategy: "systemd-repair-execution",
        plan: {
          planner: "systemd-repair-execution-task-v0",
          strategy: "operator-reviewed-systemd-repair-execution-task",
          summary: `Create an approval-gated task for ${targetUnit}; do not execute until operator approval.`,
          steps: [
            {
              id: "review-evidence",
              phase: "review_repair_evidence",
              title: "Review inventory, repair plan, and dry-run envelope",
              status: "pending",
              targetUnit,
              requiresApproval: false,
            },
            {
              id: "operator-approval",
              phase: "waiting_for_approval",
              title: "Wait for operator approval before any host mutation",
              status: "pending",
              capabilityId: "act.system.heal",
              requiresApproval: true,
              risk: "high",
            },
            {
              id: realExecution ? "execute-systemd-restart" : "defer-real-execution",
              phase: realExecution ? "operator_reviewed_real_execution" : "deferred_execution_shell",
              title: realExecution
                ? "Execute operator-approved systemd restart for the selected OpenClaw body unit"
                : "Defer real systemd restart to a future execution milestone",
              status: "pending",
              command: command?.command ?? "systemctl",
              args: command?.args ?? ["restart", targetUnit],
              requiresApproval: true,
              hostMutation: realExecution,
            },
          ],
        },
        policy: {
          request: policyRequest,
          decision: policyDecision,
        },
        systemdRepair: {
          registry: SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
          sourceRegistry: dryRunEnvelope.registry,
          inventoryRegistry: dryRunEnvelope.source?.inventoryRegistry ?? plan?.source?.inventoryRegistry ?? null,
          planRegistry: dryRunEnvelope.source?.planRegistry ?? plan?.registry ?? null,
          target: dryRunEnvelope.target,
          command: {
            command: command?.command ?? "systemctl",
            args: command?.args ?? ["restart", targetUnit],
            wouldExecute: realExecution,
          },
          evidence: {
            plan,
            dryRunEnvelope,
          },
          execution: {
            shellOnly: !realExecution,
            realExecutionEnabled: realExecution,
            executed: false,
            hostMutation: false,
            hostMutationAttempted: false,
            futureExecutionRequiresSeparateMilestone: !realExecution,
            selectedRealExecutionUnit: realExecution ? SYSTEMD_REPAIR_REAL_EXECUTION_UNIT : null,
            authDelegation: {
              mode: "native-dbus-helper-required",
              helperConfigured: false,
              passwordlessExpected: false,
              scope: "legacy browser system-unit mutation is disabled",
            },
          },
        },
      },
      governance: {
        createsTask: false,
        createsApproval: false,
        canExecuteWithoutApproval: false,
        executed: false,
        hostMutation: false,
        realExecutionEnabled: realExecution,
        requiresExplicitApproval: true,
        linkedEvidence: ["openclaw-systemd-unit-inventory-v0", "openclaw-systemd-repair-plan-v0", "openclaw-systemd-repair-dry-run-v0"],
      },
    };
  }

  async function createSystemdRepairExecutionTask({ unit = null, confirm = false, execute = false } = {}) {
    if (confirm !== true) {
      throw new Error("Systemd repair execution task creation requires confirm=true.");
    }

    const draftEnvelope = await buildSystemdRepairExecutionTaskDraft({ unit, execute });
    const draft = draftEnvelope.draft;
    const task = createTask({
      goal: draft.goal,
      type: draft.type,
      workViewStrategy: draft.workViewStrategy,
      plan: draft.plan,
      policy: draft.policy.request,
      systemdRepair: draft.systemdRepair,
    }, { skipInitialPolicy: true });
    task.policy = draft.policy;
    const approval = createApprovalRequestForTask(task, draft.policy.decision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: draft.plan?.planner ?? "systemd-repair-execution-task-v0" });
    await publishTaskApprovalIfPending(task);
    await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
      task: serialiseTask(reclaimedTask),
    })));

    return {
      registry: SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
      mode: execute === true ? "operator-reviewed-real-execution-task" : "operator-reviewed-execution-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: draftEnvelope.sourceRegistry,
      target: draftEnvelope.target,
      task,
      approval,
      repairPlan: draftEnvelope.repairPlan,
      dryRunEnvelope: draftEnvelope.dryRunEnvelope,
      governance: {
        createsTask: true,
        createsApproval: true,
        canExecuteWithoutApproval: false,
        executed: false,
        hostMutation: false,
        realExecutionEnabled: execute === true,
        requiresExplicitApproval: true,
        futureExecutionRequiresSeparateMilestone: execute !== true,
      },
    };
  }

  async function createSystemdRepairCandidateTaskShell({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Systemd repair candidate task shell creation requires confirm=true.");
    }

    const routeGate = await fetchJson(`${systemSenseUrl}/system/systemd/repair-candidate-task-route`);
    if (routeGate.routeDecision?.existingRouteAvailable !== true) {
      throw new Error("Selected repair candidate is not covered by an existing operator-reviewed task route.");
    }
    const targetUnit = routeGate.routeDecision?.targetUnit ?? null;
    const shell = await createSystemdRepairExecutionTask({
      unit: targetUnit,
      confirm: true,
      execute: false,
    });
    shell.task.systemdRepairCandidate = {
      registry: "openclaw-systemd-repair-candidate-task-shell-v0",
      routeRegistry: routeGate.registry,
      candidatePlanRegistry: routeGate.source?.candidatePlanRegistry ?? null,
      targetUnit,
      existingRoute: routeGate.routeDecision?.existingRoute ?? null,
    };
    persistState();

    return {
      registry: "openclaw-systemd-repair-candidate-task-shell-v0",
      mode: "approval-gated-candidate-task-shell",
      generatedAt: new Date().toISOString(),
      sourceRegistry: routeGate.registry,
      routeGate,
      task: shell.task,
      approval: shell.approval,
      governance: {
        createsTask: true,
        createsApproval: true,
        canExecuteWithoutApproval: false,
        executed: false,
        hostMutation: false,
        realExecutionEnabled: false,
        requiresExplicitApproval: true,
        reusesExistingOperatorReviewedRoute: true,
      },
    };
  }

  async function createSystemdNextRepairTaskShell({ confirm = false, execute = false } = {}) {
    if (confirm !== true) {
      throw new Error("Next systemd repair task shell creation requires confirm=true.");
    }

    let routeGate;
    let dryRunEvidence;
    let targetUnit;
    if (execute === true) {
      if (!SYSTEMD_REPAIR_RESTART_HELPER || SYSTEMD_REPAIR_AUTH_DELEGATION !== "polkit-dbus-fixed-unit") {
        throw new Error("Native systemd repair execution requires the fixed Polkit D-Bus helper.");
      }
      const inventory = await fetchJson(`${systemSenseUrl}/system/systemd/units`);
      const target = inventory.units?.find((unit) => unit.unit === SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT);
      if (inventory.source?.transport !== "dbus_native"
        || target?.systemdObserved !== true
        || target?.loadState !== "loaded") {
        throw new Error("Native systemd repair execution requires an observed system-sense unit inventory.");
      }
      targetUnit = SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT;
      dryRunEvidence = {
        command: "systemctl",
        args: ["restart", targetUnit],
        transport: "dbus_native",
        method: "org.freedesktop.systemd1.Manager.RestartUnit",
      };
      routeGate = {
        registry: inventory.registry,
        routeDecision: {
          taskShellAllowed: true,
          selectedSlice: "openclaw-systemd-next-repair-real-execution",
          targetUnit,
        },
        evidence: dryRunEvidence,
        inventoryObservedAt: inventory.observedAt ?? null,
      };
    } else {
      routeGate = await fetchJson(`${systemSenseUrl}/system/systemd/next-repair-task-route`);
      if (routeGate.routeDecision?.taskShellAllowed !== true
        || routeGate.routeDecision?.selectedSlice !== "openclaw-systemd-next-repair-task-shell"
        || routeGate.routeDecision?.targetUnit !== SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT) {
        throw new Error("Next systemd repair task shell requires the approved task route for openclaw-system-sense.service.");
      }
      dryRunEvidence = routeGate.evidence ?? {};
      targetUnit = routeGate.routeDecision.targetUnit;
    }
    const command = {
      command: dryRunEvidence.command ?? "systemctl",
      args: Array.isArray(dryRunEvidence.args) && dryRunEvidence.args.length > 0
        ? dryRunEvidence.args
        : ["restart", targetUnit],
      wouldExecute: execute === true,
    };
    const registry = execute === true
      ? SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY
      : SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY;
    const goal = execute === true
      ? `Operator-approved real next OpenClaw systemd repair execution for ${targetUnit}`
      : `Approval-gated next OpenClaw systemd repair task shell for ${targetUnit}`;
    const policyRequest = {
      intent: "systemd.next_repair.execute",
      domain: "body_internal",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["systemd", "repair", "host_mutation_candidate", "operator_reviewed", "next_repair"],
    };
    const policyDecision = evaluatePolicyIntent({
      type: "systemd_next_repair_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "systemd_next_repair_task_shell.draft",
      type: "systemd_next_repair_task",
      goal,
    });
    const plan = {
      planner: execute === true ? "systemd-next-repair-real-execution-v0" : "systemd-next-repair-task-shell-v0",
      strategy: execute === true ? "operator-reviewed-next-systemd-repair-real-execution" : "approval-gated-next-systemd-repair-task-shell",
      summary: execute === true
        ? `Create a queued approval-gated real execution task for ${targetUnit}; execute only after explicit approval.`
        : `Create a queued approval-gated task shell for ${targetUnit}; do not approve or execute in this milestone.`,
      steps: [
        {
          id: "review-next-repair-route",
          phase: "review_next_repair_route",
          title: "Review next repair route and dry-run evidence",
          status: "pending",
          targetUnit,
          requiresApproval: false,
        },
        {
          id: "operator-approval",
          phase: "waiting_for_approval",
          title: "Wait for operator approval before any systemd action",
          status: "pending",
          capabilityId: "act.system.heal",
          requiresApproval: true,
          risk: "high",
        },
        {
          id: execute === true ? "execute-next-systemd-restart" : "defer-next-repair-execution",
          phase: execute === true ? "next_repair_operator_reviewed_real_execution" : "next_repair_execution_deferred",
          title: execute === true
            ? "Execute operator-approved systemd restart for the selected next OpenClaw body unit"
            : "Defer restart execution to a future route-reviewed milestone",
          status: "pending",
          command: command.command,
          args: command.args,
          requiresApproval: true,
          hostMutation: execute === true,
        },
      ],
    };
    const systemdNextRepair = {
      registry,
      sourceRegistry: routeGate.registry,
      dryRunRegistry: dryRunEvidence.dryRunRegistry ?? null,
      target: {
        unit: targetUnit,
      },
      command,
      evidence: {
        routeGate,
        dryRun: dryRunEvidence,
      },
      execution: {
        shellOnly: execute !== true,
        realExecutionEnabled: execute === true,
        executed: false,
        hostMutation: false,
        hostMutationAttempted: false,
        futureExecutionRequiresSeparateMilestone: execute !== true,
      },
    };
    const task = createTask({
      goal,
      type: "systemd_next_repair_task",
      workViewStrategy: "systemd-next-repair-task",
      plan,
      policy: policyRequest,
      systemdNextRepair,
    }, { skipInitialPolicy: true });
    task.policy = {
      request: policyRequest,
      decision: policyDecision,
    };
    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent(createEventName("task.created"), { task: serialiseTask(task), planner: plan.planner });
    await publishTaskApprovalIfPending(task);
    await publishEvent(createEventName("task.planned"), { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent(createEventName("task.phase_changed"), {
      task: serialiseTask(reclaimedTask),
    })));

    return {
      registry,
      mode: execute === true
        ? "operator-reviewed-next-systemd-repair-real-execution-task"
        : "approval-gated-next-systemd-repair-task-shell",
      generatedAt: new Date().toISOString(),
      sourceRegistry: routeGate.registry,
      routeGate,
      task,
      approval,
      governance: {
        createsTask: true,
        createsApproval: true,
        canExecuteWithoutApproval: false,
        executed: false,
        hostMutation: false,
        realExecutionEnabled: execute === true,
        requiresExplicitApproval: true,
        futureExecutionRequiresSeparateMilestone: execute !== true,
      },
    };
  }

  return {
    buildSystemdRepairExecutionTaskDraft,
    createSystemdRepairExecutionTask,
    createSystemdRepairCandidateTaskShell,
    createSystemdNextRepairTaskShell,
  };
}
