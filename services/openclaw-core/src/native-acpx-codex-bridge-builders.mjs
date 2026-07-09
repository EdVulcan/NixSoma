import { createHash, randomUUID } from "node:crypto";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";

export const NATIVE_ACPX_CODEX_BRIDGE_COMPATIBILITY_REGISTRY = "openclaw-native-acpx-codex-bridge-compatibility-v0";
export const NATIVE_ACPX_CODEX_SESSION_PERSISTENCE_REGISTRY = "openclaw-native-acpx-codex-session-persistence-v0";

const SESSION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
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
        canReadCredentialValue: false,
        canCopyAuthMaterial: false,
        canWriteWrapper: false,
        canExecuteWrapper: false,
        canSpawnCodexAcp: false,
        canCallProvider: false,
        canUseNetwork: false,
        observerVisible: false,
        observerVisibilityDeferred: true,
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
    recordNativeAcpxCodexSession,
  };
}
