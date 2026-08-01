export const PRIVILEGED_CAPABILITY_BOUNDARY_REGISTRY =
  "nixsoma-privileged-capability-boundary-v0";

export const PRIVILEGED_CAPABILITY_DEFERRED_REASON =
  "privileged_capability_deferred";

const PRIVILEGED_CAPABILITIES = Object.freeze([
  {
    id: "act.host.root",
    name: "Host Root Control",
    kind: "actuator",
    intents: ["host.root"],
    description: "Deferred: root authority is never granted through the capability runtime.",
  },
  {
    id: "act.host.mutate",
    name: "Host Mutation",
    kind: "actuator",
    intents: ["host.mutate"],
    description: "Deferred: unrestricted host mutation is never granted through the capability runtime.",
  },
  {
    id: "sense.desktop.capture",
    name: "Desktop-Wide Capture",
    kind: "sensor",
    intents: ["desktop.capture"],
    description: "Deferred: desktop-wide capture is never granted; use a bounded owned surface instead.",
  },
  {
    id: "act.desktop.input",
    name: "Desktop-Wide Input",
    kind: "actuator",
    intents: ["desktop.input"],
    description: "Deferred: arbitrary desktop input is never granted through the capability runtime.",
  },
  {
    id: "act.process.any",
    name: "Arbitrary Process Control",
    kind: "actuator",
    intents: ["process.any"],
    description: "Deferred: arbitrary process control is never granted through the capability runtime.",
  },
  {
    id: "act.window.any",
    name: "Arbitrary Window Control",
    kind: "actuator",
    intents: ["window.any"],
    description: "Deferred: arbitrary window control is never granted through the capability runtime.",
  },
]);

export function buildPrivilegedCapabilityDescriptors({ host, port } = {}) {
  return PRIVILEGED_CAPABILITIES.map((capability) => ({
    ...capability,
    registry: PRIVILEGED_CAPABILITY_BOUNDARY_REGISTRY,
    service: "openclaw-core",
    endpoint: `http://${host}:${port}/capabilities/invoke`,
    domains: ["host"],
    risk: "critical",
    governance: "deferred",
    available: false,
    deferred: true,
    requiresApproval: false,
  }));
}

export function isPrivilegedCapability(capabilityId) {
  return PRIVILEGED_CAPABILITIES.some((capability) => capability.id === capabilityId);
}

export function buildPrivilegedCapabilityPolicy(capability) {
  return {
    id: PRIVILEGED_CAPABILITY_BOUNDARY_REGISTRY,
    at: null,
    engine: "capability-boundary-v0",
    stage: "capability.invoke",
    subject: {
      taskId: null,
      type: "capability_invoke",
      goal: `Invoke ${capability.id}`,
      targetUrl: null,
      intent: capability.intents?.[0] ?? capability.id,
    },
    domain: "host",
    risk: "critical",
    decision: "deny",
    reason: PRIVILEGED_CAPABILITY_DEFERRED_REASON,
    approved: false,
    autonomyMode: "guardian",
    autonomous: false,
    auditRequired: true,
    tags: ["privileged", "fail_closed", "deferred"],
  };
}
