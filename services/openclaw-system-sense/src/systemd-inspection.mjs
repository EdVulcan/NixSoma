export function createSystemdInspection({
  execFileAsync,
  serviceTimeoutMs = 1500,
  openClawSystemdUnitSpecs = [],
  platform = process.platform,
  registries = {},
} = {}) {
  const SYSTEMD_UNIT_INVENTORY_REGISTRY = registries.systemdUnitInventory ?? "openclaw-systemd-unit-inventory-v0";
  const SYSTEMD_DEPENDENCY_MAP_REGISTRY = registries.systemdDependencyMap ?? "openclaw-systemd-dependency-map-v0";

function parseSystemctlShow(output) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator === -1) {
          return [line, ""];
        }
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

async function detectSystemdAvailability() {
  if (platform !== "linux") {
    return {
      available: false,
      reason: `systemd inspection is only attempted on linux; current platform is ${platform}.`,
    };
  }

  try {
    const result = await execFileAsync("systemctl", ["--version"], {
      timeout: serviceTimeoutMs,
      windowsHide: true,
      maxBuffer: 4096,
    });
    const firstLine = result.stdout.split(/\r?\n/).find(Boolean) ?? "systemctl";
    return {
      available: true,
      version: firstLine,
    };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : "systemctl is unavailable.",
    };
  }
}

async function inspectSystemdUnit(spec, systemd) {
  const baseUnit = {
    key: spec.key,
    name: spec.name,
    unit: spec.unit,
    description: spec.description,
    component: spec.component,
    bodyOwned: true,
    planned: true,
    url: spec.url,
    after: spec.after,
    canMutate: false,
    canRestart: false,
    status: "unknown",
    loadState: "unknown",
    activeState: "unknown",
    subState: "unknown",
    unitFileState: "unknown",
    mainPid: null,
    fragmentPath: null,
    systemdObserved: false,
  };

  if (!systemd.available) {
    return {
      ...baseUnit,
      observation: "planned_inventory_only",
    };
  }

  try {
    const result = await execFileAsync("systemctl", [
      "show",
      spec.unit,
      "--property=Id",
      "--property=LoadState",
      "--property=ActiveState",
      "--property=SubState",
      "--property=UnitFileState",
      "--property=FragmentPath",
      "--property=Description",
      "--property=MainPID",
      "--property=ExecMainStatus",
      "--no-pager",
    ], {
      timeout: serviceTimeoutMs,
      windowsHide: true,
      maxBuffer: 8192,
    });
    const properties = parseSystemctlShow(result.stdout);
    return {
      ...baseUnit,
      description: properties.Description || baseUnit.description,
      status: properties.ActiveState || "unknown",
      loadState: properties.LoadState || "unknown",
      activeState: properties.ActiveState || "unknown",
      subState: properties.SubState || "unknown",
      unitFileState: properties.UnitFileState || "unknown",
      mainPid: Number.parseInt(properties.MainPID ?? "0", 10) || null,
      execMainStatus: Number.parseInt(properties.ExecMainStatus ?? "0", 10) || 0,
      fragmentPath: properties.FragmentPath || null,
      systemdObserved: true,
      observation: "systemctl_show_read_only",
    };
  } catch (error) {
    return {
      ...baseUnit,
      systemdObserved: true,
      observation: "systemctl_show_failed",
      observationError: error instanceof Error ? error.message : "Unable to inspect unit.",
    };
  }
}

async function buildSystemdUnitInventory() {
  const observedAt = new Date().toISOString();
  const systemd = await detectSystemdAvailability();
  const units = await Promise.all(openClawSystemdUnitSpecs.map((spec) => inspectSystemdUnit(spec, systemd)));
  const active = units.filter((unit) => unit.activeState === "active").length;
  const failed = units.filter((unit) => unit.activeState === "failed" || unit.subState === "failed").length;
  const inactive = units.filter((unit) => unit.activeState === "inactive").length;
  const observed = units.filter((unit) => unit.systemdObserved).length;

  return {
    ok: true,
    registry: SYSTEMD_UNIT_INVENTORY_REGISTRY,
    mode: "read_only",
    canMutate: false,
    canRestart: false,
    observedAt,
    source: {
      service: "openclaw-system-sense",
      kind: "openclaw-body-systemd-inventory",
      evidence: "read_only_body_governance",
      systemdAvailable: systemd.available,
      systemdVersion: systemd.version ?? null,
      unavailableReason: systemd.reason ?? null,
      plannedFrom: "nix/modules/openclaw-body.nix serviceSpecs",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "observe_only",
      approvalRequired: false,
      hostMutation: false,
      readOnlyCommands: systemd.available ? ["systemctl --version", "systemctl show <unit>"] : [],
      forbiddenActions: ["start", "stop", "restart", "reload", "enable", "disable"],
    },
    summary: {
      total: units.length,
      planned: units.filter((unit) => unit.planned).length,
      observed,
      active,
      inactive,
      failed,
      unknown: Math.max(0, units.length - active - inactive - failed),
      bodyOwned: units.filter((unit) => unit.bodyOwned).length,
      mutationEndpoints: 0,
      restartEndpoints: 0,
    },
    units,
    next: {
      recommendedSlice: "openclaw-systemd-repair-plan",
      boundary: "plan-only repair proposal before any host mutation",
    },
  };
}

function toUnitName(serviceName) {
  return serviceName.endsWith(".service") ? serviceName : `${serviceName}.service`;
}

function buildDownstreamMap(edges) {
  const downstream = new Map();
  for (const edge of edges) {
    const items = downstream.get(edge.from) ?? [];
    items.push(edge.to);
    downstream.set(edge.from, items);
  }
  return downstream;
}

function collectDownstreamUnits(unitName, downstreamMap, visited = new Set()) {
  for (const child of downstreamMap.get(unitName) ?? []) {
    if (visited.has(child)) {
      continue;
    }
    visited.add(child);
    collectDownstreamUnits(child, downstreamMap, visited);
  }
  return [...visited].sort();
}

function dependencyLayerForSpec(spec, specByUnit, memo = new Map()) {
  if (memo.has(spec.unit)) {
    return memo.get(spec.unit);
  }
  if (!Array.isArray(spec.after) || spec.after.length === 0) {
    memo.set(spec.unit, 0);
    return 0;
  }
  const upstreamLayers = spec.after
    .map((name) => specByUnit.get(toUnitName(name)))
    .filter(Boolean)
    .map((upstream) => dependencyLayerForSpec(upstream, specByUnit, memo));
  const layer = upstreamLayers.length === 0 ? 0 : Math.max(...upstreamLayers) + 1;
  memo.set(spec.unit, layer);
  return layer;
}

function classifyDependencyImpact(unitName, downstreamCount) {
  if (unitName === "openclaw-event-hub.service") {
    return "foundational";
  }
  if (unitName === "openclaw-core.service" || downstreamCount >= 3) {
    return "high";
  }
  if (downstreamCount > 0) {
    return "medium";
  }
  return "leaf";
}

async function buildSystemdDependencyMap() {
  const generatedAt = new Date().toISOString();
  const inventory = await buildSystemdUnitInventory();
  const unitByName = new Map(inventory.units.map((unit) => [unit.unit, unit]));
  const specByUnit = new Map(openClawSystemdUnitSpecs.map((spec) => [spec.unit, spec]));
  const edges = openClawSystemdUnitSpecs.flatMap((spec) => {
    return (spec.after ?? []).map((dependency) => ({
      from: toUnitName(dependency),
      to: spec.unit,
      relation: "after",
      direction: "upstream_to_dependent",
      bodyOwned: true,
      canMutate: false,
      description: `${spec.unit} starts after ${toUnitName(dependency)}.`,
    }));
  });
  const downstreamMap = buildDownstreamMap(edges);
  const layerMemo = new Map();
  const nodes = openClawSystemdUnitSpecs.map((spec) => {
    const unit = unitByName.get(spec.unit) ?? {};
    const upstream = (spec.after ?? []).map(toUnitName).sort();
    const downstream = collectDownstreamUnits(spec.unit, downstreamMap);
    return {
      key: spec.key,
      name: spec.name,
      unit: spec.unit,
      component: spec.component,
      description: unit.description ?? spec.description,
      activeState: unit.activeState ?? "unknown",
      subState: unit.subState ?? "unknown",
      systemdObserved: unit.systemdObserved === true,
      upstream,
      downstream,
      dependencyLayer: dependencyLayerForSpec(spec, specByUnit, layerMemo),
      impactRadius: downstream.length,
      impactClass: classifyDependencyImpact(spec.unit, downstream.length),
      canMutate: false,
      canRestart: false,
    };
  });
  const roots = nodes.filter((node) => node.upstream.length === 0).map((node) => node.unit).sort();
  const leaves = nodes.filter((node) => node.downstream.length === 0).map((node) => node.unit).sort();
  const startupLayers = nodes
    .reduce((layers, node) => {
      const key = String(node.dependencyLayer);
      layers[key] = [...(layers[key] ?? []), node.unit].sort();
      return layers;
    }, {});

  return {
    ok: true,
    registry: SYSTEMD_DEPENDENCY_MAP_REGISTRY,
    mode: "read_only_body_governance",
    generatedAt,
    source: {
      service: "openclaw-system-sense",
      inventoryRegistry: inventory.registry,
      inventoryObservedAt: inventory.observedAt,
      plannedFrom: "nix/modules/openclaw-body.nix serviceSpecs",
      evidence: "body_service_dependency_map",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "observe_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      executesCommand: false,
      readOnlySources: [inventory.registry, "serviceSpecs.after"],
      forbiddenActions: ["start", "stop", "restart", "reload", "enable", "disable"],
    },
    summary: {
      nodes: nodes.length,
      edges: edges.length,
      roots: roots.length,
      leaves: leaves.length,
      observed: nodes.filter((node) => node.systemdObserved).length,
      active: nodes.filter((node) => node.activeState === "active").length,
      highImpact: nodes.filter((node) => ["foundational", "high"].includes(node.impactClass)).length,
      mutationEndpoints: 0,
      restartEndpoints: 0,
    },
    roots,
    leaves,
    startupLayers,
    nodes,
    edges,
    next: {
      recommendedSlice: "openclaw-health-trend-summary",
      boundary: "summarize existing health snapshots before recommending recovery choices",
    },
  };
}


  return {
    buildSystemdUnitInventory,
    buildSystemdDependencyMap,
  };
}
