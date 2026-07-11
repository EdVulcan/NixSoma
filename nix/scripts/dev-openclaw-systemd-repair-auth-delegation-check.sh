#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

node - <<'EOF' "$REPO_ROOT"
const fs = require("node:fs");
const path = require("node:path");

const root = process.argv[2];
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const plan = read("docs/plans/OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md");
const bodyModule = read("nix/modules/openclaw-body.nix");
const desktopProfile = read("nix/profiles/desktop-body.nix");
const core = [
  read("services/openclaw-core/src/runtime-state.mjs"),
  read("services/openclaw-core/src/plan-builder.mjs"),
  read("services/openclaw-core/src/task-executor-system-body-handlers.mjs"),
].join("\n");
const milestone = read("nix/scripts/dev-milestone-checks.tsv");

for (const token of [
  "Second Slice: Fixed Native Restart",
  "existing next-repair proposal",
  "Polkit grants only",
  "no direct",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase B plan missing native auth delegation token: ${token}`);
  }
}

for (const token of [
  "systemdRepairAuthDelegation",
  "Polkit-authorized native D-Bus repair",
  "openclaw-systemd-native-restart-system-sense",
  "if [ \"$#\" -ne 0 ]; then",
  "systemd-dbus-restart-helper.mjs",
  "OPENCLAW_SYSTEMD_REPAIR_RESTART_HELPER",
  "OPENCLAW_SYSTEMD_REPAIR_AUTH_DELEGATION",
  "polkit-dbus-fixed-unit",
  "security.polkit.extraConfig",
  'action.id == "org.freedesktop.systemd1.manage-units"',
  'action.lookup("unit") == "openclaw-system-sense.service"',
  'action.lookup("verb") == "restart"',
  "delegationUser = if cfg.user == null then \"openclaw\" else cfg.user",
  'subject.user == "${delegationUser}"',
]) {
  if (!bodyModule.includes(token)) {
    throw new Error(`NixOS body module missing narrow auth delegation token: ${token}`);
  }
}

if (bodyModule.includes("security.sudo.extraRules") || bodyModule.includes("systemctl restart")) {
  throw new Error("Native systemd mutation must not retain sudo or systemctl execution.");
}
if (!bodyModule.includes("requires services.openclaw.user")) {
  throw new Error("Auth delegation must require a dedicated OpenClaw service user.");
}

for (const token of [
  "SYSTEMD_REPAIR_RESTART_HELPER",
  "SYSTEMD_REPAIR_AUTH_DELEGATION",
  "polkit-dbus-fixed-unit",
  "passwordPromptAllowed: false",
  "scope: \"restart openclaw-system-sense.service only\"",
  "org.freedesktop.systemd1.Manager.RestartUnit",
  "native-dbus-helper-required",
  "no command fallback",
  "actualCommand",
  "authDelegation",
]) {
  if (!core.includes(token)) {
    throw new Error(`OpenClaw core missing auth delegation evidence token: ${token}`);
  }
}

if (core.includes("execFileAsync(command.command") || core.includes("direct-systemctl")) {
  throw new Error("OpenClaw core must not retain a direct systemctl fallback.");
}
if (!core.includes("command: [command.command ?? \"systemctl\", ...args].join(\" \")")) {
  throw new Error("OpenClaw core should keep the operator-visible command transcript stable.");
}
if (!milestone.includes("openclaw-systemd-repair-auth-delegation")) {
  throw new Error("Milestone registry missing openclaw-systemd-repair-auth-delegation.");
}
for (const token of ['user = "openclaw-service"', "systemdRepairAuthDelegation.enable = true"]) {
  if (!desktopProfile.includes(token)) {
    throw new Error(`Desktop profile missing unprivileged Polkit ownership token: ${token}`);
  }
}

console.log(JSON.stringify({
  openclawSystemdRepairAuthDelegation: {
    status: "passed",
    route: "phase-b-native-systemd-mutation",
    desktopProfileEnabled: true,
    serviceUser: "openclaw-service",
    delegatedUnit: "openclaw-system-sense.service",
    delegatedAction: "restart",
    transport: "dbus_native",
    polkitAction: "org.freedesktop.systemd1.manage-units",
    broadSudoGranted: false,
    arbitrarySystemctlGranted: false,
  },
}, null, 2));
EOF
