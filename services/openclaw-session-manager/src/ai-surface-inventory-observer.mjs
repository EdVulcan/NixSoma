import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
} from "node:fs";
import path from "node:path";

export const AI_SURFACE_INVENTORY_REGISTRY =
  "nixsoma-ai-surface-inventory-v0";

const EXPECTED_RUNTIME_DIRECTORY = "nixsoma-ai-graphical-session";
const EXPECTED_SURFACE_DIRECTORY = "surfaces";
const EXPECTED_INVENTORY_FILE = "current.json";
const EXPECTED_SOCKET_NAME = "nixsoma-ai-0";
const MAX_INVENTORY_BYTES = 8_192;
const MAX_SURFACES = 16;

function readBoundedInventory(filePath) {
  const fd = openSync(
    filePath,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_CLOEXEC ?? 0),
  );
  try {
    const stats = fstatSync(fd);
    if (!stats.isFile() || stats.size < 2 || stats.size > MAX_INVENTORY_BYTES) {
      throw new Error("Surface inventory size changed before read.");
    }
    const buffer = Buffer.allocUnsafe(stats.size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const bytesRead = readSync(fd, buffer, offset, buffer.length - offset, null);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset !== stats.size) {
      throw new Error("Surface inventory changed during read.");
    }
    return buffer.subarray(0, offset).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

function enabled(value) {
  return value === true || value === "1" || value === "true";
}

function modeString(mode) {
  return (mode & 0o777).toString(8).padStart(4, "0");
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).sort().join("\0") === [...expected].sort().join("\0");
}

function validUnsignedInteger(value, maximum) {
  return Number.isInteger(value) && value >= 0 && value <= maximum;
}

function validSurface(surface) {
  return exactKeys(surface, ["surfaceId", "pid", "width", "height", "activated"])
    && validUnsignedInteger(surface.surfaceId, 0xffff_ffff)
    && surface.surfaceId > 0
    && validUnsignedInteger(surface.pid, 0x7fff_ffff)
    && surface.pid > 0
    && validUnsignedInteger(surface.width, 16_384)
    && surface.width > 0
    && validUnsignedInteger(surface.height, 16_384)
    && surface.height > 0
    && typeof surface.activated === "boolean";
}

function validBoundary(boundary) {
  return exactKeys(boundary, [
    "sourceScope",
    "titleExposed",
    "pixelsExposed",
    "parentDisplayConnected",
    "inputAuthorityExpanded",
    "persisted",
  ])
    && boundary.sourceScope === "ai_owned_nested_output_only"
    && boundary.titleExposed === false
    && boundary.pixelsExposed === false
    && boundary.parentDisplayConnected === false
    && boundary.inputAuthorityExpanded === false
    && boundary.persisted === false;
}

function baseEvidence(config) {
  return {
    registry: AI_SURFACE_INVENTORY_REGISTRY,
    enabled: config.enabled,
    status: config.enabled ? "not_observed" : "disabled",
    available: false,
    sequence: null,
    socketName: EXPECTED_SOCKET_NAME,
    count: 0,
    truncated: false,
    surfaces: [],
    source: {
      directory: EXPECTED_SURFACE_DIRECTORY,
      file: EXPECTED_INVENTORY_FILE,
      ownerMatched: false,
      mode: null,
      byteLength: 0,
    },
    boundary: {
      sourceScope: "ai_owned_nested_output_only",
      titleExposed: false,
      pixelsExposed: false,
      parentDisplayConnected: false,
      inputAuthorityExpanded: false,
      persisted: false,
    },
  };
}

export function buildAiSurfaceInventoryConfig({ env = process.env } = {}) {
  return {
    enabled: enabled(env.OPENCLAW_AI_SURFACE_INVENTORY_ENABLED),
    runtimeBaseDir: typeof env.XDG_RUNTIME_DIR === "string"
      ? env.XDG_RUNTIME_DIR.trim()
      : "",
    runtimeDirectory: typeof env.OPENCLAW_AI_GRAPHICAL_SESSION_RUNTIME_DIRECTORY === "string"
      ? env.OPENCLAW_AI_GRAPHICAL_SESSION_RUNTIME_DIRECTORY.trim()
      : EXPECTED_RUNTIME_DIRECTORY,
    surfaceDirectory: typeof env.OPENCLAW_AI_SURFACE_INVENTORY_DIRECTORY === "string"
      ? env.OPENCLAW_AI_SURFACE_INVENTORY_DIRECTORY.trim()
      : EXPECTED_SURFACE_DIRECTORY,
  };
}

export function createAiSurfaceInventoryObserver({
  env = process.env,
  stat = lstatSync,
  readInventory = readBoundedInventory,
  expectedUid = typeof process.getuid === "function" ? process.getuid() : null,
} = {}) {
  const config = buildAiSurfaceInventoryConfig({ env });

  return function observeAiSurfaceInventory() {
    const evidence = baseEvidence(config);
    if (!config.enabled) return evidence;
    if (!path.isAbsolute(config.runtimeBaseDir)
      || config.runtimeDirectory !== EXPECTED_RUNTIME_DIRECTORY
      || config.surfaceDirectory !== EXPECTED_SURFACE_DIRECTORY) {
      return { ...evidence, status: "configuration_invalid" };
    }

    const surfaceDirectory = path.join(
      config.runtimeBaseDir,
      EXPECTED_RUNTIME_DIRECTORY,
      EXPECTED_SURFACE_DIRECTORY,
    );
    let directoryStats;
    try {
      directoryStats = stat(surfaceDirectory);
    } catch {
      return { ...evidence, status: "surface_directory_missing" };
    }
    if (!directoryStats.isDirectory()
      || directoryStats.uid !== expectedUid
      || (directoryStats.mode & 0o077) !== 0) {
      return { ...evidence, status: "surface_directory_untrusted" };
    }

    const inventoryPath = path.join(surfaceDirectory, EXPECTED_INVENTORY_FILE);
    let inventoryStats;
    try {
      inventoryStats = stat(inventoryPath);
    } catch {
      return { ...evidence, status: "inventory_missing" };
    }
    const source = {
      ...evidence.source,
      ownerMatched: inventoryStats.uid === expectedUid,
      mode: modeString(inventoryStats.mode),
      byteLength: inventoryStats.size,
    };
    if (!inventoryStats.isFile()
      || !source.ownerMatched
      || (inventoryStats.mode & 0o077) !== 0
      || inventoryStats.size < 2
      || inventoryStats.size > MAX_INVENTORY_BYTES) {
      return { ...evidence, status: "inventory_untrusted", source };
    }

    let candidate;
    try {
      candidate = JSON.parse(readInventory(inventoryPath));
    } catch {
      return { ...evidence, status: "inventory_invalid", source };
    }
    const surfaces = candidate?.surfaces;
    const surfaceIds = Array.isArray(surfaces)
      ? new Set(surfaces.map((surface) => surface?.surfaceId))
      : new Set();
    const valid = exactKeys(candidate, [
      "registry",
      "sequence",
      "socketName",
      "count",
      "truncated",
      "surfaces",
      "boundary",
    ])
      && candidate.registry === AI_SURFACE_INVENTORY_REGISTRY
      && validUnsignedInteger(candidate.sequence, Number.MAX_SAFE_INTEGER)
      && candidate.socketName === EXPECTED_SOCKET_NAME
      && validUnsignedInteger(candidate.count, MAX_SURFACES)
      && typeof candidate.truncated === "boolean"
      && Array.isArray(surfaces)
      && surfaces.length === candidate.count
      && surfaces.length <= MAX_SURFACES
      && surfaceIds.size === surfaces.length
      && surfaces.every(validSurface)
      && validBoundary(candidate.boundary);
    if (!valid) {
      return { ...evidence, status: "inventory_contract_invalid", source };
    }

    return {
      ...evidence,
      status: "available",
      available: true,
      sequence: candidate.sequence,
      count: candidate.count,
      truncated: candidate.truncated,
      surfaces: candidate.surfaces.map((surface) => ({ ...surface })),
      source,
    };
  };
}
