// packages/shared-utils/src/persist.mjs
// 防抖持久化模式（core 和 system-heal 共用）

import { chmodSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";

export function createDebouncedPersist(stateFilePath, buildPayload, debounceMs = 50) {
  let timer = null;

  function writeImmediate() {
    try {
      mkdirSync(path.dirname(stateFilePath), { recursive: true, mode: 0o700 });
      const tempPath = `${stateFilePath}.tmp`;
      writeFileSync(tempPath, `${JSON.stringify(buildPayload(), null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      chmodSync(tempPath, 0o600);
      renameSync(tempPath, stateFilePath);
    } catch (error) {
      console.error(`Failed to persist state to ${stateFilePath}:`, error);
    }
  }

  function persistState() {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; writeImmediate(); }, debounceMs);
  }

  persistState.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    writeImmediate();
  };

  return persistState;
}
