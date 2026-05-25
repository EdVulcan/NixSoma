#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

checks=(
  "dev-observer-openclaw-eye-hand-recovery-regression-check.sh"
  "dev-observer-openclaw-system-health-self-heal-evidence-check.sh"
  "dev-observer-openclaw-mvp-route-alignment-check.sh"
)

run_child_check() {
  env \
    -u OPENCLAW_CORE_PORT \
    -u OPENCLAW_EVENT_HUB_PORT \
    -u OPENCLAW_SESSION_MANAGER_PORT \
    -u OPENCLAW_BROWSER_RUNTIME_PORT \
    -u OPENCLAW_SCREEN_SENSE_PORT \
    -u OPENCLAW_SCREEN_ACT_PORT \
    -u OPENCLAW_SYSTEM_SENSE_PORT \
    -u OPENCLAW_SYSTEM_HEAL_PORT \
    -u OBSERVER_UI_PORT \
    -u OPENCLAW_CORE_STATE_FILE \
    bash "$1"
}

for check in "${checks[@]}"; do
  echo "==> observer MVP readiness: $check"
  run_child_check "$SCRIPT_DIR/$check"
done

echo '{"observerOpenClawMvpReadiness":{"status":"passed","checks":3,"mainline":"observer-visible-body-loop-readiness"}}'
