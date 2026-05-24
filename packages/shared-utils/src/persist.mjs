// packages/shared-utils/src/persist.mjs
// 防抖持久化模式（core 和 system-heal 共用）

import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";

export function createDebouncedPersist(stateFilePath, buildPayload, debounceMs = 50) {
  let timer = null;

  function writeImmediate() {
    try {
      mkdirSync(path.dirname(stateFilePath), { recursive: true });
      const tempPath = `${stateFilePath}.tmp`;
      writeFileSync(tempPath, `${JSON.stringify(buildPayload(), null, 2)}\n`, "utf8");
      renameSync(tempPath, stateFilePath);
    } catch (error) {
      console.error(`Failed to persist state to ${stateFilePath}:`, error);
    }
  }

  return function persistState() {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; writeImmediate(); }, debounceMs);
  };
}
