import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import {
  isNativePluginRuntimeActivationTask,
  isNativePluginRuntimeAdapterTask,
  isOpenClawSearchWebAdapterTask,
  isOpenClawSearchWebRuntimeActivationTask,
  isOpenClawSearchWebProviderRuntimeSandboxTask,
} from "./task-recovery.mjs";

export function createNativeDeferredTaskHandlers({ state, taskManager, approvalEngine, policyEvaluator, publishEvent }) {
  const { approvals } = state;
  const { serialiseTask, isActiveTask, setTaskPhase } = taskManager;
  const { serialiseApproval } = approvalEngine;
  const { ensureTaskPolicy } = policyEvaluator;

  function isNativePluginCapabilityTask(task) {
    return task?.type === "native_plugin_capability";
  }

  async function deferNativePluginCapabilityExecution(task) {
    if (!isActiveTask(task)) {
      throw new Error("Task is not active and cannot be deferred.");
    }

    const policy = ensureTaskPolicy(task, { stage: "native_plugin.invoke.deferred" });
    await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const capabilityStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.capability.invoke") ?? null;
    const reason = "runtime_adapter_deferred";
    const deferredTask = await setTaskPhase(task, reason, {
      status: "queued",
      details: {
        executor: "native-plugin-adapter-v0",
        reason,
        capabilityId: capabilityStep?.capabilityId ?? "act.plugin.capability.invoke",
        pluginId: capabilityStep?.params?.pluginId ?? null,
        packageName: capabilityStep?.params?.packageName ?? null,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        requiresRuntimeAdapterBeforeExecution: true,
      },
    });

    await publishEvent(createEventName("task.blocked"), {
      task: serialiseTask(deferredTask),
      reason,
      executor: "native-plugin-adapter-v0",
    });

    return {
      task: deferredTask,
      blocked: true,
      reason,
      actions: [],
      capabilityInvocations: [],
      commandTranscript: [],
      verification: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      governance: {
        mode: "native_plugin_runtime_adapter_deferred",
        runtimeOwner: "openclaw_on_nixos",
        canExecutePluginCode: false,
        canActivateRuntime: false,
        executed: false,
        requiresRuntimeAdapterBeforeExecution: true,
      },
    };
  }

  async function deferNativePluginRuntimeActivation(task) {
    if (!isActiveTask(task)) {
      throw new Error("Task is not active and cannot be deferred.");
    }

    const policy = ensureTaskPolicy(task, { stage: "native_plugin.runtime_activation.deferred" });
    await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const activationStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.runtime_activation") ?? null;
    const reason = "native_plugin_runtime_activation_deferred";
    const deferredTask = await setTaskPhase(task, "runtime_activation_deferred", {
      status: "queued",
      details: {
        executor: "native-plugin-runtime-activation-v0",
        reason,
        pluginId: activationStep?.params?.pluginId ?? null,
        packageName: activationStep?.params?.packageName ?? null,
        capabilityId: activationStep?.params?.capabilityId ?? "act.plugin.capability.invoke",
        blockedGateIds: activationStep?.params?.blockedGateIds ?? [],
        canReadSourceFileContent: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        requiresRuntimeAdapterBeforeExecution: true,
      },
    });

    await publishEvent(createEventName("task.blocked"), {
      task: serialiseTask(deferredTask),
      reason,
      executor: "native-plugin-runtime-activation-v0",
    });

    return {
      task: deferredTask,
      blocked: true,
      reason,
      actions: [],
      capabilityInvocations: [],
      commandTranscript: [],
      verification: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      governance: {
        mode: "native_plugin_runtime_activation_deferred",
        runtimeOwner: "openclaw_on_nixos",
        canReadSourceFileContent: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        executed: false,
        requiresRuntimeAdapterBeforeExecution: true,
      },
    };
  }

  async function deferNativePluginRuntimeAdapterImplementation(task) {
    if (!isActiveTask(task)) {
      throw new Error("Task is not active and cannot be deferred.");
    }

    const policy = ensureTaskPolicy(task, { stage: "native_plugin.runtime_adapter.deferred" });
    await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const adapterStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.runtime_adapter_implementation") ?? null;
    const reason = "native_plugin_runtime_adapter_implementation_deferred";
    const deferredTask = await setTaskPhase(task, "runtime_adapter_implementation_deferred", {
      status: "queued",
      details: {
        executor: "native-plugin-runtime-adapter-v0",
        reason,
        contractId: adapterStep?.params?.contractId ?? null,
        contractVersion: adapterStep?.params?.contractVersion ?? null,
        pluginId: adapterStep?.params?.pluginId ?? null,
        packageName: adapterStep?.params?.packageName ?? null,
        capabilityId: adapterStep?.params?.capabilityId ?? "act.plugin.capability.invoke",
        blockedCheckIds: adapterStep?.params?.blockedCheckIds ?? [],
        canReadSourceFileContent: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        requiresRuntimeAdapterBeforeExecution: true,
      },
    });

    await publishEvent(createEventName("task.blocked"), {
      task: serialiseTask(deferredTask),
      reason,
      executor: "native-plugin-runtime-adapter-v0",
    });

    return {
      task: deferredTask,
      blocked: true,
      reason,
      actions: [],
      capabilityInvocations: [],
      commandTranscript: [],
      verification: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      governance: {
        mode: "native_plugin_runtime_adapter_implementation_deferred",
        runtimeOwner: "openclaw_on_nixos",
        canReadSourceFileContent: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        executed: false,
        requiresRuntimeAdapterBeforeExecution: true,
      },
    };
  }

  async function deferOpenClawSearchWebAdapterExecution(task) {
    if (!isActiveTask(task)) {
      throw new Error("Task is not active and cannot be deferred.");
    }

    const policy = ensureTaskPolicy(task, { stage: "openclaw.search_web.invoke.deferred" });
    await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const providerStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.search_web.invoke") ?? null;
    const reason = "search_web_runtime_preflight_deferred";
    const deferredTask = await setTaskPhase(task, "network_provider_deferred", {
      status: "queued",
      details: {
        executor: "openclaw-search-web-adapter-v0",
        reason,
        providerContractId: providerStep?.params?.providerContractId ?? null,
        operation: providerStep?.params?.operation ?? null,
        queryLength: providerStep?.params?.queryLength ?? null,
        queryDigest: providerStep?.params?.queryDigest ?? null,
        queryContentExposed: false,
        canUseNetwork: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        requiresRuntimePreflightBeforeExecution: true,
      },
    });

    await publishEvent(createEventName("task.blocked"), {
      task: serialiseTask(deferredTask),
      reason,
      executor: "openclaw-search-web-adapter-v0",
    });

    return {
      task: deferredTask,
      blocked: true,
      reason,
      actions: [],
      capabilityInvocations: [],
      commandTranscript: [],
      verification: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      governance: {
        mode: "openclaw_search_web_runtime_preflight_deferred",
        runtimeOwner: "openclaw_on_nixos",
        canUseNetwork: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        executed: false,
        requiresRuntimePreflightBeforeExecution: true,
      },
    };
  }

  async function deferOpenClawSearchWebRuntimeActivation(task) {
    if (!isActiveTask(task)) {
      throw new Error("Task is not active and cannot be deferred.");
    }

    const policy = ensureTaskPolicy(task, { stage: "openclaw.search_web.runtime_activation.deferred" });
    await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const activationStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.search_web.runtime_activation") ?? null;
    const reason = "search_web_network_runtime_adapter_deferred";
    const deferredTask = await setTaskPhase(task, "network_runtime_deferred", {
      status: "queued",
      details: {
        executor: "openclaw-search-web-runtime-activation-v0",
        reason,
        providerContractId: activationStep?.params?.providerContractId ?? null,
        operation: activationStep?.params?.operation ?? null,
        blockedGateIds: activationStep?.params?.blockedGateIds ?? [],
        queryContentExposed: false,
        canUseNetwork: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        requiresRuntimeAdapterBeforeExecution: true,
      },
    });

    await publishEvent(createEventName("task.blocked"), {
      task: serialiseTask(deferredTask),
      reason,
      executor: "openclaw-search-web-runtime-activation-v0",
    });

    return {
      task: deferredTask,
      blocked: true,
      reason,
      actions: [],
      capabilityInvocations: [],
      commandTranscript: [],
      verification: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      governance: {
        mode: "openclaw_search_web_network_runtime_adapter_deferred",
        runtimeOwner: "openclaw_on_nixos",
        canUseNetwork: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        executed: false,
        requiresRuntimeAdapterBeforeExecution: true,
      },
    };
  }

  async function deferOpenClawSearchWebProviderRuntimeSandbox(task) {
    if (!isActiveTask(task)) {
      throw new Error("Task is not active and cannot be deferred.");
    }

    const policy = ensureTaskPolicy(task, { stage: "openclaw.search_web.provider_runtime_sandbox.deferred" });
    await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const sandboxStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.search_web.provider_runtime_sandbox") ?? null;
    const reason = "search_web_provider_runtime_sandbox_deferred";
    const deferredTask = await setTaskPhase(task, "provider_runtime_sandbox_deferred", {
      status: "queued",
      details: {
        executor: "openclaw-search-web-provider-runtime-sandbox-v0",
        reason,
        providerContractId: sandboxStep?.params?.providerContractId ?? null,
        manifestId: sandboxStep?.params?.manifestId ?? null,
        sandboxId: sandboxStep?.params?.sandboxId ?? null,
        contractVersion: sandboxStep?.params?.contractVersion ?? null,
        blockedCheckIds: sandboxStep?.params?.blockedCheckIds ?? [],
        queryContentExposed: false,
        endpointHostsExposed: false,
        authEnvVarNamesExposed: false,
        canUseNetwork: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        requiresRuntimeAdapterBeforeExecution: true,
      },
    });

    await publishEvent(createEventName("task.blocked"), {
      task: serialiseTask(deferredTask),
      reason,
      executor: "openclaw-search-web-provider-runtime-sandbox-v0",
    });

    return {
      task: deferredTask,
      blocked: true,
      reason,
      actions: [],
      capabilityInvocations: [],
      commandTranscript: [],
      verification: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      governance: {
        mode: "openclaw_search_web_provider_runtime_sandbox_deferred",
        runtimeOwner: "openclaw_on_nixos",
        canUseNetwork: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        executed: false,
        requiresRuntimeAdapterBeforeExecution: true,
      },
    };
  }

  return [
    { name: "native-plugin-capability", predicate: isNativePluginCapabilityTask, execute: deferNativePluginCapabilityExecution },
    { name: "native-plugin-runtime-activation", predicate: isNativePluginRuntimeActivationTask, execute: deferNativePluginRuntimeActivation },
    { name: "native-plugin-runtime-adapter", predicate: isNativePluginRuntimeAdapterTask, execute: deferNativePluginRuntimeAdapterImplementation },
    { name: "openclaw-search-web-adapter", predicate: isOpenClawSearchWebAdapterTask, execute: deferOpenClawSearchWebAdapterExecution },
    { name: "openclaw-search-web-runtime-activation", predicate: isOpenClawSearchWebRuntimeActivationTask, execute: deferOpenClawSearchWebRuntimeActivation },
    { name: "openclaw-search-web-provider-runtime-sandbox", predicate: isOpenClawSearchWebProviderRuntimeSandboxTask, execute: deferOpenClawSearchWebProviderRuntimeSandbox },
  ];
}
