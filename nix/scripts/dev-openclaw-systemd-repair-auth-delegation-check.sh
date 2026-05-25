#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

node - <<'EOF' "$REPO_ROOT"
const fs = require("node:fs");
const path = require("node:path");

const root = process.argv[2];
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const plan = read("docs/plans/OPENCLAW_PHASE_2_PLAN.md");
const bodyModule = read("nix/modules/openclaw-body.nix");
const core = [
  read("services/openclaw-core/src/server.mjs"),
  read("services/openclaw-core/src/runtime-state.mjs"),
  read("services/openclaw-core/src/plan-builder.mjs"),
  read("services/openclaw-core/src/task-executor.mjs"),
].join("\n");
const milestone = read("nix/scripts/dev-milestone-check.sh");

for (const token of [
  "openclaw-systemd-repair-auth-delegation",
  "Delegates only the already-approved `openclaw-browser-runtime.service` restart path",
  "fixed helper that accepts no arguments",
  "Must not grant passwordless `ALL`, arbitrary `systemctl`, shell access",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing auth delegation route token: ${token}`);
  }
}

for (const token of [
  "systemdRepairAuthDelegation",
  "mkEnableOption \"passwordless OpenClaw-owned systemd repair delegation\"",
  "openclaw-systemd-repair-restart-browser-runtime",
  "if [ \"$#\" -ne 0 ]; then",
  "exec ${pkgs.systemd}/bin/systemctl restart openclaw-browser-runtime.service",
  "OPENCLAW_SYSTEMD_REPAIR_RESTART_HELPER",
  'OPENCLAW_SYSTEMD_REPAIR_RESTART_HELPER_SUDO = "/run/wrappers/bin/sudo"',
  "OPENCLAW_SYSTEMD_REPAIR_AUTH_DELEGATION",
  "security.sudo.extraRules",
  "delegationUser = if cfg.user == null then \"openclaw\" else cfg.user",
  "users = [ delegationUser ]",
  "options = [ \"NOPASSWD\" ]",
]) {
  if (!bodyModule.includes(token)) {
    throw new Error(`NixOS body module missing narrow auth delegation token: ${token}`);
  }
}

if (bodyModule.includes("NOPASSWD: ALL") || bodyModule.includes("command = \"ALL\"")) {
  throw new Error("NixOS body module must not grant passwordless ALL.");
}
if (!bodyModule.includes("requires services.openclaw.user")) {
  throw new Error("Auth delegation must require a dedicated OpenClaw service user.");
}

for (const token of [
  "SYSTEMD_REPAIR_RESTART_HELPER",
  "SYSTEMD_REPAIR_RESTART_HELPER_SUDO",
  "SYSTEMD_REPAIR_AUTH_DELEGATION",
  "sudo-nopasswd-fixed-helper",
  "passwordPromptAllowed: false",
  "scope: \"restart openclaw-browser-runtime.service only\"",
  "actualCommand",
  "authDelegation",
]) {
  if (!core.includes(token)) {
    throw new Error(`OpenClaw core missing auth delegation evidence token: ${token}`);
  }
}

if (!core.includes("const args = useRestartHelper ? [\"-n\", SYSTEMD_REPAIR_RESTART_HELPER] : requestedArgs;")) {
  throw new Error("OpenClaw core should invoke sudo non-interactively so repair actions never wait for a password prompt.");
}
if (!core.includes("command: [command.command ?? \"systemctl\", ...args].join(\" \")")) {
  throw new Error("OpenClaw core should keep the operator-visible command transcript stable.");
}
if (!milestone.includes("openclaw-systemd-repair-auth-delegation")) {
  throw new Error("Milestone registry missing openclaw-systemd-repair-auth-delegation.");
}

console.log(JSON.stringify({
  openclawSystemdRepairAuthDelegation: {
    status: "passed",
    route: "phase-2-repair-demo-usability",
    defaultEnabled: false,
    delegatedUnit: "openclaw-browser-runtime.service",
    delegatedAction: "restart",
    passwordlessScope: "fixed helper only",
    broadSudoGranted: false,
    arbitrarySystemctlGranted: false,
  },
}, null, 2));
EOF
