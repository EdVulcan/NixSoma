import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { normaliseBoundedBrowserUrl } from "./browser-navigation.mjs";

const WORKSPACE_REGISTRY = "openclaw-browser-workspace-intent-v0";
const MAX_STATE_BYTES = 128 * 1024;
const MAX_TABS = 32;

function boundedString(value, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, maxLength) : null;
}

function boundedUrl(value, { allowLocalFixtureUrls = false } = {}) {
  if (!value) return null;
  try {
    return normaliseBoundedBrowserUrl(value, { allowLocalFixtureUrls });
  } catch {
    return null;
  }
}

function normalizeTab(value, options = {}) {
  const id = boundedString(value?.id, 160);
  const url = boundedUrl(value?.url, options);
  if (!id || !url) return null;
  return {
    id,
    url,
    title: boundedString(value?.title, 200) ?? new URL(url).hostname,
    createdAt: boundedString(value?.createdAt, 64),
  };
}

function buildWorkspaceIntent(browserState, now, options = {}) {
  const tabs = (Array.isArray(browserState?.tabs) ? browserState.tabs : [])
    .slice(-MAX_TABS)
    .map((tab) => normalizeTab(tab, options))
    .filter(Boolean);
  const activeUrl = boundedUrl(browserState?.activeUrl, options);
  return {
    registry: WORKSPACE_REGISTRY,
    persistedAt: now(),
    workspace: {
      profile: boundedString(browserState?.profile, 120) ?? "ai-browser-profile",
      sessionId: boundedString(browserState?.sessionId, 256),
      sessionAuthority: boundedString(browserState?.sessionAuthority, 120),
      activeTitle: boundedString(browserState?.activeTitle, 200),
      activeUrl,
      tabs,
      wasRunning: browserState?.running === true || browserState?.wasRunning === true,
    },
    safety: {
      trustedHelperLeasePersisted: false,
      inputPersisted: false,
      clickPersisted: false,
      capturePersisted: false,
      processIdPersisted: false,
      automaticActionReplay: false,
    },
  };
}

function normalizePersistedIntent(value, options = {}) {
  if (value?.registry !== WORKSPACE_REGISTRY || !value.workspace) {
    throw new Error("Browser workspace intent registry is invalid.");
  }
  return buildWorkspaceIntent(value.workspace, () => boundedString(value.persistedAt, 64), options);
}

export function createBrowserWorkspaceStore({
  stateFilePath,
  now = () => new Date().toISOString(),
  allowLocalFixtureUrls = false,
} = {}) {
  if (typeof stateFilePath !== "string" || !stateFilePath.trim()) {
    throw new Error("Browser workspace store requires a state file path.");
  }
  const targetPath = path.resolve(stateFilePath);

  function restore() {
    try {
      if (statSync(targetPath).size > MAX_STATE_BYTES) {
        throw new Error("Browser workspace intent exceeds the bounded state size.");
      }
      const parsed = JSON.parse(readFileSync(targetPath, "utf8"));
      const intent = normalizePersistedIntent(parsed, { allowLocalFixtureUrls });
      return {
        restored: true,
        status: "restored_requires_explicit_prepare",
        intent,
      };
    } catch (error) {
      if (error?.code === "ENOENT") {
        return { restored: false, status: "not_found", intent: null };
      }
      return {
        restored: false,
        status: "invalid_state_ignored",
        intent: null,
        error: error instanceof Error ? error.message : "browser_workspace_restore_failed",
      };
    }
  }

  function persist(browserState) {
    const intent = buildWorkspaceIntent(browserState, now, { allowLocalFixtureUrls });
    const serialized = `${JSON.stringify(intent, null, 2)}\n`;
    if (Buffer.byteLength(serialized, "utf8") > MAX_STATE_BYTES) {
      throw new Error("Browser workspace intent exceeds the bounded state size.");
    }
    mkdirSync(path.dirname(targetPath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${targetPath}.tmp-${process.pid}`;
    try {
      writeFileSync(temporaryPath, serialized, { encoding: "utf8", mode: 0o600 });
      chmodSync(temporaryPath, 0o600);
      renameSync(temporaryPath, targetPath);
    } finally {
      rmSync(temporaryPath, { force: true });
    }
    return intent;
  }

  return { persist, restore };
}
