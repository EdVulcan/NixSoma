import { createHash, randomUUID } from "node:crypto";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

export const NATIVE_ACPX_CODEX_BRIDGE_COMPATIBILITY_REGISTRY = "openclaw-native-acpx-codex-bridge-compatibility-v0";
export const NATIVE_ACPX_CODEX_SESSION_PERSISTENCE_REGISTRY = "openclaw-native-acpx-codex-session-persistence-v0";
export const NATIVE_ACPX_CODEX_BRIDGE_WRAPPER_DRAFT_REGISTRY = "openclaw-native-acpx-codex-bridge-wrapper-draft-v0";
export const NATIVE_ACPX_CODEX_BRIDGE_WRAPPER_WRITE_PROPOSAL_REGISTRY = "openclaw-native-acpx-codex-bridge-wrapper-write-proposal-v0";
export {
  buildNativeAcpxCodexBridgeProcessSpawnProposal,
  NATIVE_ACPX_CODEX_BRIDGE_PROCESS_SPAWN_PROPOSAL_REGISTRY,
} from "./native-acpx-codex-process-spawn-proposal-builders.mjs";

const SESSION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const COMMAND_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const SECRET_KEY_PATTERN = /(auth|token|secret|password|credential|api[_-]?key|private[_-]?key)/i;

function nowIso() {
  return new Date().toISOString();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normaliseSessionKey(value) {
  const key = typeof value === "string" ? value.trim() : "";
  if (!key || !SESSION_KEY_PATTERN.test(key)) {
    throw new Error("ACPX/Codex sessionKey must be 1-120 chars and use only letters, numbers, '.', '_', ':', or '-'.");
  }
  if (key.includes("..") || key.includes("/") || key.includes("\\")) {
    throw new Error("ACPX/Codex sessionKey must not contain path traversal or separators.");
  }
  return key;
}

function normaliseAgentId(value) {
  const agentId = typeof value === "string" && value.trim() ? value.trim() : "codex";
  if (!SESSION_KEY_PATTERN.test(agentId)) {
    throw new Error("ACPX/Codex agentId must use only letters, numbers, '.', '_', ':', or '-'.");
  }
  return agentId;
}

function normaliseRecordId(value, sessionKey) {
  const recordId = typeof value === "string" && value.trim() ? value.trim() : `acpx-record-${sha256(sessionKey).slice(0, 12)}`;
  if (!SESSION_KEY_PATTERN.test(recordId)) {
    throw new Error("ACPX/Codex recordId must use only letters, numbers, '.', '_', ':', or '-'.");
  }
  return recordId;
}

function normaliseCommandName(value) {
  const commandName = typeof value === "string" && value.trim() ? value.trim() : "npx";
  if (!COMMAND_NAME_PATTERN.test(commandName) || commandName.includes("..")) {
    throw new Error("ACPX/Codex bridge command must be a simple command name without separators.");
  }
  return commandName;
}

function normaliseWrapperName(value, sessionKey = null) {
  const fallback = `codex-acp-${sha256(sessionKey ?? "unselected-session").slice(0, 12)}.sh`;
  const wrapperName = typeof value === "string" && value.trim() ? value.trim() : fallback;
  if (!COMMAND_NAME_PATTERN.test(wrapperName.replace(/\.sh$/u, "")) || wrapperName.includes("/") || wrapperName.includes("\\") || wrapperName.includes("..")) {
    throw new Error("ACPX/Codex bridge wrapperName must be a simple filename stem, optionally ending in .sh.");
  }
  return wrapperName.endsWith(".sh") ? wrapperName : `${wrapperName}.sh`;
}

function compactWrapperDraft(draft) {
  return {
    registry: draft?.registry ?? null,
    mode: draft?.mode ?? null,
    proposalId: draft?.proposal?.id ?? null,
    status: draft?.proposal?.status ?? null,
    readyForApprovalBridge: draft?.summary?.readyForApprovalBridge === true,
    wrapperRelativePath: draft?.proposal?.wrapper?.relativePath ?? null,
    command: draft?.proposal?.command?.command ?? null,
    commandArgs: draft?.proposal?.command?.args ?? [],
  };
}

function wrapperCommandForPlatform(commandName) {
  if (commandName === "npx" || commandName === "npx.cmd") {
    return {
      commandExpression: 'process.platform === "win32" ? "npx.cmd" : "npx"',
      args: ["@zed-industries/codex-acp@^0.11.1"],
      sourcePackage: "@zed-industries/codex-acp@^0.11.1",
    };
  }
  return {
    commandExpression: JSON.stringify(commandName),
    args: ["acp"],
    sourcePackage: null,
  };
}

function buildWrapperContentPreview({ commandName, clearEnv = [] }) {
  const command = wrapperCommandForPlatform(commandName);
  const clearEnvKeys = Array.isArray(clearEnv) ? clearEnv.filter((key) => typeof key === "string") : [];
  return `#!/usr/bin/env node
import { spawn } from "node:child_process";

const OPENCLAW_APPROVED_CODEX_HOME = "__OPENCLAW_APPROVED_CODEX_HOME__";
const env = { ...process.env, CODEX_HOME: OPENCLAW_APPROVED_CODEX_HOME };
for (const key of ${JSON.stringify(clearEnvKeys)}) {
  delete env[key];
}

const child = spawn(${command.commandExpression}, ${JSON.stringify(command.args)}, {
  stdio: "inherit",
  env,
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
`;
}

function sanitiseMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const redacted = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 20)) {
    if (typeof key !== "string" || !key.trim()) {
      continue;
    }
    const safeKey = key.trim().slice(0, 80);
    if (SECRET_KEY_PATTERN.test(safeKey)) {
      redacted[safeKey] = "[redacted-key]";
      continue;
    }
    if (["string", "number", "boolean"].includes(typeof value)) {
      const serialised = String(value);
      redacted[safeKey] = serialised.length > 160 ? `${serialised.slice(0, 160)}...` : value;
    }
  }
  return redacted;
}

function serialiseRecord(record) {
  return record
    ? {
        sessionKey: record.sessionKey,
        agentId: record.agentId,
        acpxRecordId: record.acpxRecordId,
        revision: record.revision,
        metadata: record.metadata ?? {},
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        credentialValueRead: false,
        authMaterialCopied: false,
        wrapperWritten: false,
        processSpawned: false,
      }
    : null;
}

function listRecords(records) {
  return [...records.values()]
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .map(serialiseRecord);
}

export function createNativeAcpxCodexBridgeBuilders({
  state,
  publishEvent = async () => {},
}) {
  const {
    acpxBridgeSessionRecords,
    MAX_ACPX_BRIDGE_SESSION_RECORDS,
    persistState,
  } = state;

  function buildNativeAcpxCodexBridgeCompatibility({ sessionKey = null } = {}) {
    const selectedSessionKey = sessionKey ? normaliseSessionKey(sessionKey) : null;
    const selectedRecord = selectedSessionKey ? acpxBridgeSessionRecords.get(selectedSessionKey) ?? null : null;
    const records = listRecords(acpxBridgeSessionRecords);
    const generatedAt = nowIso();

    return {
      ok: true,
      registry: NATIVE_ACPX_CODEX_BRIDGE_COMPATIBILITY_REGISTRY,
      mode: "compatibility-and-persistence-evidence",
      generatedAt,
      identityLevel: "Level 1: stable user-space control plane",
      sourceCapability: {
        sourceFiles: [
          "extensions/acpx/src/codex-auth-bridge.ts",
          "extensions/acpx/src/runtime-persistence.test.ts",
        ],
        migrationMode: "native_compatibility_contract_without_reference_runtime_dependency",
      },
      compatibility: {
        currentRuntimeSubject: "OpenClaw_On_NixOS",
        targetBridge: "future ACP/Codex bridge for the NixOS body",
        posixCommand: "npx",
        windowsCommandLesson: "npx.cmd",
        commandOverrideSupportedByContract: true,
        wrapperCommandDrafted: false,
        wrapperWriteProposalReady: false,
        wrapperWritten: false,
        codexAcpProcessSpawned: false,
      },
      authIsolation: {
        sourceCodexHomeRead: false,
        authJsonRead: false,
        configTomlRead: false,
        authMaterialCopied: false,
        credentialValueRead: false,
        secretValuesEmbeddedInWrapper: false,
        clearEnvKeysMaterialized: false,
      },
      persistence: {
        registry: NATIVE_ACPX_CODEX_SESSION_PERSISTENCE_REGISTRY,
        storeReady: true,
        totalRecords: records.length,
        maxRecords: MAX_ACPX_BRIDGE_SESSION_RECORDS,
        selectedSessionKey,
        selectedRecord: serialiseRecord(selectedRecord),
        records,
        supportsIndependentSessions: true,
        supportsOverwrite: true,
        missingSessionReturnsNull: selectedSessionKey !== null && selectedRecord === null,
      },
      governance: {
        mode: "native_acpx_codex_bridge_compatibility",
        runtimeOwner: "openclaw_on_nixos",
        canPersistSessionMetadata: true,
        canBuildWrapperWriteProposal: true,
        canReadCredentialValue: false,
        canCopyAuthMaterial: false,
        canWriteWrapper: false,
        canExecuteWrapper: false,
        canSpawnCodexAcp: false,
        canCallProvider: false,
        canUseNetwork: false,
        observerVisible: true,
        observerVisibilityDeferred: false,
      },
      auditEvidence: {
        operation: "acpx_codex_bridge_compatibility_read",
        capabilityId: "sense.openclaw.acpx_codex_bridge.compatibility",
        generatedAt,
        persisted: false,
        evidenceKind: "response_embedded_audit_evidence",
      },
      deferredExecutionBoundaries: [
        "no CODEX_HOME read",
        "no auth.json or config.toml read",
        "no auth material copy",
        "no wrapper file write",
        "no npx or npx.cmd execution",
        "no ACP/Codex process spawn",
        "no provider call",
        "no network egress",
      ],
    };
  }

  function buildNativeAcpxCodexBridgeWrapperDraft({
    sessionKey = null,
    command = null,
    wrapperName = null,
  } = {}) {
    const selectedSessionKey = sessionKey ? normaliseSessionKey(sessionKey) : null;
    const selectedRecord = selectedSessionKey ? acpxBridgeSessionRecords.get(selectedSessionKey) ?? null : null;
    const commandName = normaliseCommandName(command);
    const safeWrapperName = normaliseWrapperName(wrapperName, selectedSessionKey);
    const generatedAt = nowIso();
    const readyForApprovalBridge = selectedRecord !== null;
    const readinessGates = [
      {
        id: "selected-session-metadata",
        status: readyForApprovalBridge ? "passed" : "blocked",
        requiredForApprovalBridge: true,
        evidence: selectedRecord ? "persisted_session_metadata_found" : "missing_session_metadata",
      },
      {
        id: "auth-isolation",
        status: "passed",
        requiredForApprovalBridge: true,
        credentialValueRead: false,
        authMaterialCopied: false,
      },
      {
        id: "wrapper-write-boundary",
        status: "deferred",
        requiredForApprovalBridge: true,
        wrapperWritten: false,
        futureApprovalRequired: true,
      },
      {
        id: "process-spawn-boundary",
        status: "deferred",
        requiredForApprovalBridge: true,
        commandExecuted: false,
        processSpawned: false,
        futureApprovalRequired: true,
      },
    ];
    const gatesPassed = readinessGates.filter((gate) => gate.status === "passed").length;
    const gatesBlocked = readinessGates.filter((gate) => gate.status === "blocked").length;
    const gatesDeferred = readinessGates.filter((gate) => gate.status === "deferred").length;

    return {
      ok: true,
      registry: NATIVE_ACPX_CODEX_BRIDGE_WRAPPER_DRAFT_REGISTRY,
      mode: "proposal-only-acpx-codex-bridge-wrapper-action-draft",
      generatedAt,
      identityLevel: "Level 1: stable user-space control plane",
      sourceCapability: {
        sourceFiles: [
          "extensions/acpx/src/codex-auth-bridge.ts",
          "extensions/acpx/src/runtime-persistence.test.ts",
        ],
        migrationMode: "native_wrapper_action_proposal_without_auth_copy_or_process_spawn",
      },
      proposal: {
        id: `acpx-codex-wrapper-draft-${sha256(`${selectedSessionKey ?? "none"}:${safeWrapperName}:${commandName}`).slice(0, 12)}`,
        capabilityId: "plan.openclaw.acpx_codex_bridge.wrapper_action",
        status: readyForApprovalBridge ? "ready_for_approval_bridge" : "blocked_missing_session_metadata",
        session: {
          requestedSessionKey: selectedSessionKey,
          selectedRecord: serialiseRecord(selectedRecord),
        },
        wrapper: {
          relativePath: `.openclaw/acpx/codex-bridge/${safeWrapperName}`,
          contentPreviewExposed: false,
          contentHashComputed: false,
          wrapperWritten: false,
        },
        command: {
          command: commandName,
          args: commandName === "npx" || commandName === "npx.cmd" ? ["@openai/codex", "acp"] : ["acp"],
          commandOverrideSupported: true,
          commandExecuted: false,
          processSpawned: false,
        },
        authIsolation: {
          codexHomeRead: false,
          authJsonRead: false,
          configTomlRead: false,
          authMaterialCopied: false,
          credentialValueRead: false,
          secretValuesEmbeddedInWrapper: false,
        },
      },
      readinessGates,
      summary: {
        readyForApprovalBridge,
        gatesPassed,
        gatesBlocked,
        gatesDeferred,
        credentialValueRead: false,
        authMaterialCopied: false,
        wrapperWritten: false,
        commandExecuted: false,
        processSpawned: false,
        providerCalled: false,
        networkUsed: false,
      },
      governance: {
        canDraftWrapperAction: true,
        createsTask: false,
        createsApproval: false,
        canReadCredentialValue: false,
        canCopyAuthMaterial: false,
        canWriteWrapper: false,
        canExecuteWrapper: false,
        canSpawnCodexAcp: false,
        canCallProvider: false,
        canUseNetwork: false,
        futureWrapperWriteRequiresApproval: true,
        futureProcessSpawnRequiresApproval: true,
        observerVisible: true,
      },
      auditEvidence: {
        operation: "acpx_codex_bridge_wrapper_action_draft",
        capabilityId: "plan.openclaw.acpx_codex_bridge.wrapper_action",
        generatedAt,
        persisted: false,
        evidenceKind: "proposal_embedded_audit_evidence",
      },
      deferredExecutionBoundaries: [
        "no CODEX_HOME read",
        "no auth.json or config.toml read",
        "no auth material copy",
        "no wrapper file write",
        "no npx or npx.cmd execution",
        "no ACP/Codex process spawn",
        "no provider call",
        "no network egress",
        "no task or approval creation in this draft route",
      ],
    };
  }

  function buildNativeAcpxCodexBridgeWrapperWriteProposal({
    sessionKey = null,
    command = null,
    wrapperName = null,
  } = {}) {
    const draft = buildNativeAcpxCodexBridgeWrapperDraft({ sessionKey, command, wrapperName });
    const commandName = draft.proposal?.command?.command ?? normaliseCommandName(command);
    const wrapperRelativePath = draft.proposal?.wrapper?.relativePath ?? `.openclaw/acpx/codex-bridge/${normaliseWrapperName(wrapperName, sessionKey)}`;
    const contentPreview = buildWrapperContentPreview({ commandName });
    const contentHash = `sha256:${sha256(contentPreview)}`;
    const generatedAt = nowIso();
    const readyForWriteApproval = draft.summary?.readyForApprovalBridge === true;
    const commandShape = wrapperCommandForPlatform(commandName);

    return {
      ok: true,
      registry: NATIVE_ACPX_CODEX_BRIDGE_WRAPPER_WRITE_PROPOSAL_REGISTRY,
      mode: "proposal-only-acpx-codex-bridge-wrapper-write-preview",
      generatedAt,
      identityLevel: "Level 1: stable user-space control plane",
      sourceCapability: {
        sourceFiles: [
          "extensions/acpx/src/codex-auth-bridge.ts",
          "extensions/acpx/src/codex-auth-bridge.test.ts",
        ],
        migrationMode: "native_wrapper_write_proposal_without_auth_copy_or_file_write",
      },
      sourceDraft: compactWrapperDraft(draft),
      proposal: {
        id: `acpx-codex-wrapper-write-${sha256(`${draft.proposal?.id ?? "none"}:${contentHash}`).slice(0, 12)}`,
        capabilityId: "plan.openclaw.acpx_codex_bridge.wrapper_write",
        status: readyForWriteApproval ? "ready_for_write_approval" : "blocked_missing_session_metadata",
        wrapper: {
          relativePath: wrapperRelativePath,
          directoryRelativePath: wrapperRelativePath.split("/").slice(0, -1).join("/"),
          fileMode: "0700",
          directoryMode: "0700",
          contentPreview,
          contentHash,
          contentPreviewBytes: Buffer.byteLength(contentPreview, "utf8"),
          contentPreviewExposed: true,
          wrapperWritten: false,
          chmodApplied: false,
          directoryCreated: false,
        },
        command: {
          command: commandName,
          spawnCommandExpression: commandShape.commandExpression,
          args: commandShape.args,
          sourcePackage: commandShape.sourcePackage,
          commandExecuted: false,
          processSpawned: false,
        },
        authIsolation: {
          approvedCodexHomePlaceholder: "__OPENCLAW_APPROVED_CODEX_HOME__",
          codexHomeRead: false,
          authJsonRead: false,
          configTomlRead: false,
          authMaterialCopied: false,
          credentialValueRead: false,
          secretValuesEmbeddedInWrapper: false,
          clearEnvKeysMaterialized: false,
        },
        writeBoundary: {
          futureWriteCapabilityId: "act.openclaw.workspace_text_write",
          futureApprovalRequired: true,
          writeTaskCreated: false,
          approvalCreated: false,
          ledgerExpectedAfterWrite: true,
          workspaceRootRequired: true,
          traversalProtectedByWorkspaceTextWrite: true,
        },
      },
      readinessGates: [
        {
          id: "source-wrapper-draft",
          status: readyForWriteApproval ? "passed" : "blocked",
          evidence: draft.proposal?.status ?? "missing",
        },
        {
          id: "content-preview",
          status: "passed",
          contentHash,
          secretValuesEmbeddedInWrapper: false,
        },
        {
          id: "workspace-write-approval",
          status: "deferred",
          futureCapabilityId: "act.openclaw.workspace_text_write",
          writeTaskCreated: false,
          approvalCreated: false,
        },
        {
          id: "runtime-execution",
          status: "deferred",
          commandExecuted: false,
          processSpawned: false,
        },
      ],
      summary: {
        readyForWriteApproval,
        contentPreviewReady: true,
        contentHash,
        wrapperWritten: false,
        directoryCreated: false,
        chmodApplied: false,
        credentialValueRead: false,
        authMaterialCopied: false,
        commandExecuted: false,
        processSpawned: false,
        providerCalled: false,
        networkUsed: false,
      },
      governance: {
        canBuildWrapperWriteProposal: true,
        createsTask: false,
        createsApproval: false,
        canReadCredentialValue: false,
        canCopyAuthMaterial: false,
        canWriteWrapper: false,
        canExecuteWrapper: false,
        canSpawnCodexAcp: false,
        canCallProvider: false,
        canUseNetwork: false,
        futureWrapperWriteRequiresApproval: true,
        futureWrapperWriteUsesWorkspaceTextWrite: true,
        futureProcessSpawnRequiresApproval: true,
        observerVisible: true,
      },
      auditEvidence: {
        operation: "acpx_codex_bridge_wrapper_write_proposal",
        capabilityId: "plan.openclaw.acpx_codex_bridge.wrapper_write",
        generatedAt,
        persisted: false,
        evidenceKind: "proposal_embedded_audit_evidence",
      },
      deferredExecutionBoundaries: [
        "no CODEX_HOME read",
        "no auth.json or config.toml read",
        "no auth material copy",
        "no wrapper directory creation",
        "no wrapper file write",
        "no chmod",
        "no npx or npx.cmd execution",
        "no ACP/Codex process spawn",
        "no provider call",
        "no network egress",
        "no task or approval creation in this proposal route",
      ],
    };
  }

  async function recordNativeAcpxCodexSession({
    sessionKey,
    agentId = "codex",
    recordId = null,
    metadata = {},
    confirm = false,
  } = {}) {
    if (confirm !== true) {
      throw new Error("ACPX/Codex session persistence requires confirm=true.");
    }

    const safeSessionKey = normaliseSessionKey(sessionKey);
    const safeAgentId = normaliseAgentId(agentId);
    const safeRecordId = normaliseRecordId(recordId, safeSessionKey);
    const existing = acpxBridgeSessionRecords.get(safeSessionKey) ?? null;
    const at = nowIso();
    const record = {
      sessionKey: safeSessionKey,
      agentId: safeAgentId,
      acpxRecordId: safeRecordId,
      revision: (existing?.revision ?? 0) + 1,
      metadata: sanitiseMetadata(metadata),
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
      nonce: randomUUID(),
    };
    acpxBridgeSessionRecords.set(safeSessionKey, record);

    if (acpxBridgeSessionRecords.size > MAX_ACPX_BRIDGE_SESSION_RECORDS) {
      const oldest = [...acpxBridgeSessionRecords.values()]
        .sort((left, right) => String(left.updatedAt).localeCompare(String(right.updatedAt)))[0];
      if (oldest?.sessionKey && oldest.sessionKey !== safeSessionKey) {
        acpxBridgeSessionRecords.delete(oldest.sessionKey);
      }
    }

    persistState();
    await publishEvent(createEventName("acpx_codex.session_recorded"), {
      registry: NATIVE_ACPX_CODEX_SESSION_PERSISTENCE_REGISTRY,
      session: serialiseRecord(record),
    });

    return {
      ok: true,
      registry: NATIVE_ACPX_CODEX_SESSION_PERSISTENCE_REGISTRY,
      mode: "native-acpx-codex-session-metadata-persistence",
      generatedAt: at,
      session: serialiseRecord(record),
      summary: {
        persisted: true,
        created: existing === null,
        overwritten: existing !== null,
        totalRecords: acpxBridgeSessionRecords.size,
        credentialValueRead: false,
        authMaterialCopied: false,
        wrapperWritten: false,
        processSpawned: false,
      },
      governance: {
        canPersistSessionMetadata: true,
        canReadCredentialValue: false,
        canCopyAuthMaterial: false,
        canWriteWrapper: false,
        canExecuteWrapper: false,
        canSpawnCodexAcp: false,
        canUseNetwork: false,
      },
    };
  }

  return {
    buildNativeAcpxCodexBridgeCompatibility,
    buildNativeAcpxCodexBridgeWrapperDraft,
    buildNativeAcpxCodexBridgeWrapperWriteProposal,
    recordNativeAcpxCodexSession,
  };
}
