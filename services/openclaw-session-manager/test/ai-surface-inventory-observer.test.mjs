import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createAiSurfaceInventoryObserver } from "../src/ai-surface-inventory-observer.mjs";

function validInventory(overrides = {}) {
  return {
    registry: "nixsoma-ai-surface-inventory-v0",
    sequence: 7,
    socketName: "nixsoma-ai-0",
    count: 1,
    truncated: false,
    surfaces: [{ surfaceId: 42, pid: 1234, width: 1280, height: 720, activated: true }],
    boundary: {
      sourceScope: "ai_owned_nested_output_only",
      titleExposed: false,
      pixelsExposed: false,
      parentDisplayConnected: false,
      inputAuthorityExpanded: false,
      persisted: false,
    },
    ...overrides,
  };
}

function fixture() {
  const runtimeBase = mkdtempSync(path.join(tmpdir(), "nixsoma-surfaces-"));
  const surfaceDirectory = path.join(runtimeBase, "nixsoma-ai-graphical-session", "surfaces");
  mkdirSync(surfaceDirectory, { recursive: true, mode: 0o700 });
  chmodSync(path.dirname(surfaceDirectory), 0o700);
  chmodSync(surfaceDirectory, 0o700);
  const inventoryPath = path.join(surfaceDirectory, "current.json");
  const env = {
    XDG_RUNTIME_DIR: runtimeBase,
    OPENCLAW_AI_SURFACE_INVENTORY_ENABLED: "1",
    OPENCLAW_AI_GRAPHICAL_SESSION_RUNTIME_DIRECTORY: "nixsoma-ai-graphical-session",
    OPENCLAW_AI_SURFACE_INVENTORY_DIRECTORY: "surfaces",
  };
  return { runtimeBase, surfaceDirectory, inventoryPath, env };
}

test("surface inventory exposes only bounded numeric compositor metadata", () => {
  const files = fixture();
  try {
    writeFileSync(files.inventoryPath, `${JSON.stringify(validInventory())}\n`, { mode: 0o600 });
    const evidence = createAiSurfaceInventoryObserver({ env: files.env })();
    assert.equal(evidence.status, "available");
    assert.equal(evidence.available, true);
    assert.equal(evidence.count, 1);
    assert.deepEqual(evidence.surfaces, [
      { surfaceId: 42, pid: 1234, width: 1280, height: 720, activated: true },
    ]);
    assert.equal(JSON.stringify(evidence).includes("title"), true);
    assert.equal(JSON.stringify(evidence).includes("terminal"), false);
    assert.equal(evidence.boundary.pixelsExposed, false);
  } finally {
    rmSync(files.runtimeBase, { recursive: true, force: true });
  }
});

test("surface inventory rejects text-bearing surface records and duplicate IDs", () => {
  const files = fixture();
  try {
    const candidate = validInventory({
      count: 2,
      surfaces: [
        { surfaceId: 42, pid: 1234, width: 1280, height: 720, activated: true },
        { surfaceId: 42, pid: 1235, width: 640, height: 480, activated: false, title: "forbidden" },
      ],
    });
    writeFileSync(files.inventoryPath, JSON.stringify(candidate), { mode: 0o600 });
    const evidence = createAiSurfaceInventoryObserver({ env: files.env })();
    assert.equal(evidence.status, "inventory_contract_invalid");
    assert.deepEqual(evidence.surfaces, []);
  } finally {
    rmSync(files.runtimeBase, { recursive: true, force: true });
  }
});

test("surface inventory rejects symlink and group-writable files", () => {
  const files = fixture();
  const external = path.join(files.runtimeBase, "external.json");
  try {
    writeFileSync(external, JSON.stringify(validInventory()), { mode: 0o600 });
    symlinkSync(external, files.inventoryPath);
    assert.equal(createAiSurfaceInventoryObserver({ env: files.env })().status, "inventory_untrusted");
    rmSync(files.inventoryPath);
    writeFileSync(files.inventoryPath, JSON.stringify(validInventory()), { mode: 0o660 });
    chmodSync(files.inventoryPath, 0o660);
    assert.equal(createAiSurfaceInventoryObserver({ env: files.env })().status, "inventory_untrusted");
  } finally {
    rmSync(files.runtimeBase, { recursive: true, force: true });
  }
});
