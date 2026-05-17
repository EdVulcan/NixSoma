import {
  OPENCLAW_NATIVE_RUNTIME_OWNER,
  createOpenClawNativePluginContract,
  summariseOpenClawNativePluginContract,
  validateOpenClawNativePluginContract,
} from "./plugin-contract.mjs";

export const OPENCLAW_NATIVE_PLUGIN_REGISTRY_VERSION = "openclaw-native-plugin-registry-v0";

export const OPENCLAW_NATIVE_PLUGIN_REGISTRY_MODE = "native-contract-registry";

export const OPENCLAW_NATIVE_PLUGIN_ACTIVATION_MODE = "manual_adapter_required";

export function createOpenClawNativePluginRegistry({ generatedAt = new Date().toISOString() } = {}) {
  const pluginSdkContract = createOpenClawNativePluginContract({
    plugin: {
      id: "openclaw.native.plugin-sdk",
      name: "OpenClaw Native Plugin SDK",
      version: "0.1.0",
      summary: "Native contract surface for governed OpenClaw capabilities.",
    },
    governance: {
      origin: "absorbed_external",
      sourceContentImported: false,
      requiresHumanReviewBeforeActivation: true,
    },
    capabilities: [
      {
        id: "sense.plugin.manifest_profile",
        title: "Profile plugin manifest metadata",
        description: "Reads bounded plugin manifest metadata without importing source contents.",
        kind: "sense",
        domains: ["body_internal"],
        risk: "low",
        permissions: {
          filesystemRead: true,
        },
        approval: {
          required: false,
          reason: "Read-only metadata profiling inside the body boundary.",
        },
        audit: {
          required: true,
          ledger: "capability_history",
        },
      },
      {
        id: "sense.openclaw.tool_catalog",
        title: "Profile OpenClaw tool catalog",
        description: "Summarizes enhanced OpenClaw tool surfaces as native capability metadata without executing legacy tools.",
        kind: "sense",
        domains: ["body_internal"],
        risk: "low",
        permissions: {
          filesystemRead: true,
        },
        approval: {
          required: false,
          reason: "Read-only capability catalog profiling inside the body boundary.",
        },
        audit: {
          required: true,
          ledger: "capability_history",
        },
      },
      {
        id: "sense.openclaw.workspace_semantic_index",
        title: "Profile OpenClaw workspace semantic index",
        description: "Builds a bounded derived semantic index from enhanced OpenClaw source and documentation metadata without exposing file contents.",
        kind: "sense",
        domains: ["body_internal"],
        risk: "low",
        permissions: {
          filesystemRead: true,
        },
        approval: {
          required: false,
          reason: "Read-only semantic indexing inside the body boundary.",
        },
        audit: {
          required: true,
          ledger: "capability_history",
        },
      },
      {
        id: "sense.openclaw.workspace_symbol_lookup",
        title: "Execute OpenClaw workspace symbol lookup",
        description: "Runs a bounded read-only symbol query over enhanced OpenClaw workspace files without importing modules, executing legacy code, or exposing function bodies.",
        kind: "sense",
        domains: ["body_internal"],
        risk: "low",
        permissions: {
          filesystemRead: true,
        },
        approval: {
          required: false,
          reason: "Read-only symbol lookup inside the body boundary.",
        },
        audit: {
          required: true,
          ledger: "capability_history",
        },
      },
      {
        id: "sense.openclaw.workspace_edit_target_select",
        title: "Select OpenClaw workspace edit target",
        description: "Builds a bounded read-only target selection envelope for enhanced OpenClaw workspace edits from source-derived metadata without exposing file bodies.",
        kind: "sense",
        domains: ["body_internal"],
        risk: "low",
        permissions: {
          filesystemRead: true,
        },
        approval: {
          required: false,
          reason: "Read-only target selection inside the body boundary.",
        },
        audit: {
          required: true,
          ledger: "capability_history",
        },
      },
      {
        id: "act.openclaw.workspace_text_write",
        title: "Apply OpenClaw workspace text write",
        description: "Materializes a bounded OpenClaw workspace text write only through explicit approval, native filesystem governance, and filesystem ledgering.",
        kind: "act",
        domains: ["body_internal"],
        risk: "high",
        permissions: {
          filesystemWrite: true,
        },
        approval: {
          required: true,
          reason: "Workspace mutations require explicit user approval and filesystem ledgering.",
        },
        audit: {
          required: true,
          ledger: "filesystem_ledger",
        },
      },
      {
        id: "act.openclaw.workspace_patch_apply",
        title: "Apply OpenClaw workspace patch",
        description: "Creates governed proposal envelopes from request metadata or enhanced OpenClaw source signals, with bounded single, multi-hunk, and structured line-edit previews, then applies them only after explicit approval through native filesystem governance.",
        kind: "act",
        domains: ["body_internal"],
        risk: "high",
        permissions: {
          filesystemRead: true,
          filesystemWrite: true,
        },
        approval: {
          required: true,
          reason: "Workspace patch application requires explicit user approval and filesystem ledgering.",
        },
        audit: {
          required: true,
          ledger: "filesystem_ledger",
        },
      },
      {
        id: "sense.openclaw.prompt_pack",
        title: "Profile OpenClaw prompt pack",
        description: "Summarizes enhanced OpenClaw prompt and agent-behavior surfaces as native policy metadata without importing runtime modules.",
        kind: "sense",
        domains: ["body_internal"],
        risk: "low",
        permissions: {
          filesystemRead: true,
        },
        approval: {
          required: false,
          reason: "Read-only prompt and behavior metadata profiling inside the body boundary.",
        },
        audit: {
          required: true,
          ledger: "capability_history",
        },
      },
      {
        id: "sense.openclaw.plugin_manifest_map",
        title: "Profile OpenClaw plugin manifest map",
        description: "Maps enhanced OpenClaw plugin manifests into OpenClawOnNixOS native registry candidates without activation.",
        kind: "sense",
        domains: ["body_internal"],
        risk: "low",
        permissions: {
          filesystemRead: true,
        },
        approval: {
          required: false,
          reason: "Read-only plugin manifest mapping inside the body boundary.",
        },
        audit: {
          required: true,
          ledger: "capability_history",
        },
      },
      {
        id: "plan.openclaw.plugin_capability",
        title: "Plan OpenClaw plugin capability absorption",
        description: "Derives native capability candidates and governance gates from enhanced OpenClaw plugin manifests without importing, executing, or activating plugins.",
        kind: "plan",
        domains: ["body_internal"],
        risk: "low",
        permissions: {
          filesystemRead: true,
        },
        approval: {
          required: false,
          reason: "Plan-only plugin capability absorption inside the body boundary.",
        },
        audit: {
          required: true,
          ledger: "capability_history",
        },
      },
      {
        id: "act.plugin.capability.invoke",
        title: "Invoke a governed plugin capability",
        description: "Invokes a registered capability only after policy evaluation and audit binding.",
        kind: "act",
        domains: ["user_task", "cross_boundary"],
        risk: "high",
        permissions: {
          commandExecution: true,
          filesystemWrite: true,
        },
        approval: {
          required: true,
          reason: "Execution and mutation require explicit user approval.",
        },
        audit: {
          required: true,
          ledger: "capability_history",
        },
      },
    ],
  });

  return {
    registry: OPENCLAW_NATIVE_PLUGIN_REGISTRY_VERSION,
    mode: OPENCLAW_NATIVE_PLUGIN_REGISTRY_MODE,
    runtimeOwner: OPENCLAW_NATIVE_RUNTIME_OWNER,
    activationMode: OPENCLAW_NATIVE_PLUGIN_ACTIVATION_MODE,
    generatedAt,
    items: [
      {
        id: pluginSdkContract.plugin.id,
        status: "contract_ready",
        contract: pluginSdkContract,
      },
    ],
    governance: {
      runtimeOwner: OPENCLAW_NATIVE_RUNTIME_OWNER,
      externalRuntimeDependencyAllowed: false,
      sourceContentImported: false,
      canCreateTasks: false,
      canCreateApprovals: false,
      canExecuteDuringRegistration: false,
      canActivateRuntime: false,
      requiresHumanReviewBeforeActivation: true,
    },
  };
}

export function validateOpenClawNativePluginRegistry(registry) {
  const issues = [];
  const addIssue = (path, message) => issues.push({ path, message });

  if (registry?.registry !== OPENCLAW_NATIVE_PLUGIN_REGISTRY_VERSION) {
    addIssue("registry", `must be ${OPENCLAW_NATIVE_PLUGIN_REGISTRY_VERSION}`);
  }
  if (registry?.mode !== OPENCLAW_NATIVE_PLUGIN_REGISTRY_MODE) {
    addIssue("mode", `must be ${OPENCLAW_NATIVE_PLUGIN_REGISTRY_MODE}`);
  }
  if (registry?.runtimeOwner !== OPENCLAW_NATIVE_RUNTIME_OWNER) {
    addIssue("runtimeOwner", "must stay owned by OpenClawOnNixOS");
  }
  if (registry?.activationMode !== OPENCLAW_NATIVE_PLUGIN_ACTIVATION_MODE) {
    addIssue("activationMode", `must be ${OPENCLAW_NATIVE_PLUGIN_ACTIVATION_MODE}`);
  }
  if (!Array.isArray(registry?.items) || registry.items.length === 0) {
    addIssue("items", "must contain at least one native plugin contract");
  } else {
    registry.items.forEach((item, index) => {
      if (typeof item?.id !== "string" || item.id.trim().length === 0) {
        addIssue(`items[${index}].id`, "must be a non-empty string");
      }
      if (item?.status !== "contract_ready" && item?.status !== "blocked") {
        addIssue(`items[${index}].status`, "must be contract_ready or blocked");
      }
      const validation = validateOpenClawNativePluginContract(item?.contract);
      for (const issue of validation.issues) {
        addIssue(`items[${index}].contract.${issue.path}`, issue.message);
      }
    });
  }

  const governance = registry?.governance ?? {};
  for (const [field, expected] of Object.entries({
    runtimeOwner: OPENCLAW_NATIVE_RUNTIME_OWNER,
    externalRuntimeDependencyAllowed: false,
    sourceContentImported: false,
    canCreateTasks: false,
    canCreateApprovals: false,
    canExecuteDuringRegistration: false,
    canActivateRuntime: false,
    requiresHumanReviewBeforeActivation: true,
  })) {
    if (governance[field] !== expected) {
      addIssue(`governance.${field}`, `must be ${String(expected)}`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function summariseOpenClawNativePluginRegistry(registry) {
  const validation = validateOpenClawNativePluginRegistry(registry);
  const items = Array.isArray(registry?.items) ? registry.items : [];
  let totalCapabilities = 0;
  let approvalRequired = 0;
  let mutationCapable = 0;
  let executionCapable = 0;
  const byPlugin = {};

  for (const item of items) {
    const summary = summariseOpenClawNativePluginContract(item.contract);
    byPlugin[item.id] = {
      status: item.status,
      totalCapabilities: summary.totalCapabilities,
      approvalRequired: summary.approvalRequired,
      mutationCapable: summary.mutationCapable,
      executionCapable: summary.executionCapable,
    };
    totalCapabilities += summary.totalCapabilities;
    approvalRequired += summary.approvalRequired;
    mutationCapable += summary.mutationCapable;
    executionCapable += summary.executionCapable;
  }

  return {
    registry: OPENCLAW_NATIVE_PLUGIN_REGISTRY_VERSION,
    runtimeOwner: registry?.runtimeOwner ?? null,
    activationMode: registry?.activationMode ?? null,
    totalPlugins: items.length,
    totalCapabilities,
    approvalRequired,
    mutationCapable,
    executionCapable,
    validationOk: validation.ok,
    issueCount: validation.issues.length,
    byPlugin,
    governance: registry?.governance ?? {},
  };
}
