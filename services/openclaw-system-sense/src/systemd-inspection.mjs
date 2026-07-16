export function createSystemdInspection({
  systemdAdapter,
  openClawSystemdUnitSpecs = [],
  platform = process.platform,
  registries = {},
} = {}) {
  const SYSTEMD_UNIT_INVENTORY_REGISTRY = registries.systemdUnitInventory ?? "openclaw-systemd-unit-inventory-v0";
  const SYSTEMD_DEPENDENCY_MAP_REGISTRY = registries.systemdDependencyMap ?? "openclaw-systemd-dependency-map-v0";
  const NATIVE_DEPENDENCIES = Symbol("nativeDependencies");

  function sameStringSet(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  function attachNativeDependencyEvidence(response, systemd) {
    Object.defineProperty(response, NATIVE_DEPENDENCIES, {
      value: systemd.nativeDependencies instanceof Map ? systemd.nativeDependencies : null,
      enumerable: false,
    });
    return response;
  }

  function systemdNativeDependencies(inventory) {
    return inventory[NATIVE_DEPENDENCIES] instanceof Map ? inventory[NATIVE_DEPENDENCIES] : null;
  }

async function detectSystemdAvailability() {
  if (platform !== "linux") {
    return {
      available: false,
      reason: `systemd inspection is only attempted on linux; current platform is ${platform}.`,
      transport: "unavailable",
      nativeFailureReason: null,
    };
  }

  if (systemdAdapter?.inspectUnits) {
    try {
      return await systemdAdapter.inspectUnits(openClawSystemdUnitSpecs.map((spec) => spec.unit));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Native systemd D-Bus is unavailable.";
      return {
        available: false,
        reason,
        transport: "dbus_unavailable",
        nativeFailureReason: reason,
      };
    }
  }

  return {
    available: false,
    reason: "Native systemd D-Bus adapter is not configured.",
    transport: "dbus_unavailable",
    nativeFailureReason: "Native systemd D-Bus adapter is not configured.",
  };
}

function buildBaseUnit(spec) {
  return {
    key: spec.key,
    name: spec.name,
    unit: spec.unit,
    description: spec.description,
    component: spec.component,
    bodyOwned: true,
    planned: true,
    expectedManager: spec.expectedManager ?? "unknown",
    observedManager: null,
    managerScopeStatus: "not_checked",
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
}

function isMissingSystemdUnit(observed) {
  const detail = `${observed?.errorCode ?? ""} ${observed?.error ?? ""}`;
  return detail.includes("NoSuchUnit") || detail.includes("NoSuchFile");
}

function inspectNativeSystemdUnit(spec, systemd) {
  const baseUnit = buildBaseUnit(spec);
  const observed = systemd.units.get(spec.unit);
  if (!observed?.found) {
    const missing = isMissingSystemdUnit(observed);
    return {
      ...baseUnit,
      systemdObserved: true,
      observedManager: "not_observed",
      managerScopeStatus: missing
        ? spec.expectedManager === "user"
          ? "not_observed_on_system_bus"
          : spec.expectedManager === "system" ? "missing_from_system_manager" : "not_observed"
        : "system_bus_observation_failed",
      observation: "dbus_properties_read_failed",
      observationError: observed?.error ?? "Native systemd unit observation is missing.",
    };
  }
  const properties = observed.properties;
  return {
    ...baseUnit,
    description: properties.Description || baseUnit.description,
    status: properties.ActiveState || "unknown",
    loadState: properties.LoadState || "unknown",
    activeState: properties.ActiveState || "unknown",
    subState: properties.SubState || "unknown",
    unitFileState: properties.UnitFileState || "unknown",
    mainPid: Number(properties.MainPID) || null,
    execMainStatus: Number(properties.ExecMainStatus) || 0,
    fragmentPath: properties.FragmentPath || null,
    systemdObserved: true,
    observedManager: "system",
    managerScopeStatus: spec.expectedManager === "system"
      ? "matched"
      : spec.expectedManager === "user" ? "unexpected_system_unit" : "observed_system_manager",
    observation: "dbus_properties_read_only",
  };
}

function inspectSystemdUnit(spec, systemd) {
  const baseUnit = buildBaseUnit(spec);

  if (!systemd.available) {
    return {
      ...baseUnit,
      managerScopeStatus: "unavailable",
      observation: "planned_inventory_only",
    };
  }

  return inspectNativeSystemdUnit(spec, systemd);
}

async function buildSystemdUnitInventory() {
  const observedAt = new Date().toISOString();
  const systemd = await detectSystemdAvailability();
  const units = await Promise.all(openClawSystemdUnitSpecs.map((spec) => inspectSystemdUnit(spec, systemd)));
  const active = units.filter((unit) => unit.activeState === "active").length;
  const failed = units.filter((unit) => unit.activeState === "failed" || unit.subState === "failed").length;
  const inactive = units.filter((unit) => unit.activeState === "inactive").length;
  const observed = units.filter((unit) => unit.systemdObserved).length;
  const managerScopeConfigured = units.filter((unit) => unit.expectedManager !== "unknown");

  return attachNativeDependencyEvidence({
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
      transport: systemd.transport,
      nativeUnavailableReason: systemd.nativeFailureReason ?? null,
      plannedFrom: "nix/modules/openclaw-body.nix serviceSpecs",
      managerScopeTransport: systemd.available ? "system_bus_only" : "unavailable",
      expectedUserManagerUnits: units
        .filter((unit) => unit.expectedManager === "user")
        .map((unit) => unit.unit)
        .sort(),
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "observe_only",
      approvalRequired: false,
      hostMutation: false,
      readOnlyDbusMethods: systemd.transport === "dbus_native" ? systemd.readOnlyMethods : [],
      readOnlyCommands: [],
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
      managerScopeConfigured: managerScopeConfigured.length,
      managerScopeMatched: units.filter((unit) => unit.managerScopeStatus === "matched").length,
      managerScopeMismatches: units.filter((unit) => [
        "unexpected_system_unit",
        "missing_from_system_manager",
      ].includes(unit.managerScopeStatus)).length,
      managerScopeUnresolved: units.filter((unit) => [
        "not_checked",
        "unavailable",
        "not_observed_on_system_bus",
        "system_bus_observation_failed",
      ].includes(unit.managerScopeStatus)).length,
      mutationEndpoints: 0,
      restartEndpoints: 0,
    },
    units,
    next: {
      recommendedSlice: "openclaw-systemd-repair-plan",
      boundary: "plan-only repair proposal before any host mutation",
    },
  }, systemd);
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
  const nativeDependencies = systemdNativeDependencies(inventory);
  const observedEdges = nativeDependencies
    ? [...nativeDependencies.entries()].flatMap(([dependent, upstream]) => upstream.map((dependency) => ({
      from: dependency,
      to: dependent,
      relation: "after",
      direction: "upstream_to_dependent",
      bodyOwned: true,
      canMutate: false,
      evidence: "dbus_native_unit_after",
      description: `${dependent} is observed after ${dependency} in the running systemd manager.`,
    })))
    : [];
  const observedDownstreamMap = buildDownstreamMap(observedEdges);
  const downstreamMap = buildDownstreamMap(edges);
  const layerMemo = new Map();
  const nodes = openClawSystemdUnitSpecs.map((spec) => {
    const unit = unitByName.get(spec.unit) ?? {};
    const plannedUpstream = (spec.after ?? []).map(toUnitName).sort();
    const observedUpstream = nativeDependencies?.has(spec.unit) ? nativeDependencies.get(spec.unit) : null;
    const dependencyDrift = Array.isArray(observedUpstream)
      && !sameStringSet(plannedUpstream, observedUpstream);
    const downstream = collectDownstreamUnits(spec.unit, downstreamMap);
    const observedDownstream = collectDownstreamUnits(spec.unit, observedDownstreamMap);
    return {
      key: spec.key,
      name: spec.name,
      unit: spec.unit,
      component: spec.component,
      description: unit.description ?? spec.description,
      activeState: unit.activeState ?? "unknown",
      subState: unit.subState ?? "unknown",
      systemdObserved: unit.systemdObserved === true,
      upstream: plannedUpstream,
      downstream,
      plannedUpstream,
      observedUpstream,
      observedDownstream,
      dependencyEvidence: observedUpstream === null ? "service_specs_after" : "dbus_native_unit_after",
      dependencyDrift,
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
      dependencyEvidence: nativeDependencies ? "dbus_native_unit_after" : "service_specs_after",
      nativeDependencyObservedNodes: nativeDependencies ? nativeDependencies.size : 0,
      nativeDependencyReadOnlyMethod: nativeDependencies
        ? "org.freedesktop.DBus.Properties.GetAll"
        : null,
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
      readOnlySources: [
        inventory.registry,
        "serviceSpecs.after",
        ...(nativeDependencies ? ["systemd.Unit.After"] : []),
      ],
      forbiddenActions: ["start", "stop", "restart", "reload", "enable", "disable"],
    },
    summary: {
      nodes: nodes.length,
      edges: edges.length,
      roots: roots.length,
      leaves: leaves.length,
      observed: nodes.filter((node) => node.systemdObserved).length,
      observedDependencyNodes: nativeDependencies?.size ?? 0,
      observedEdges: observedEdges.length,
      dependencyDriftNodes: nodes.filter((node) => node.dependencyDrift).length,
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
    observedEdges,
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
