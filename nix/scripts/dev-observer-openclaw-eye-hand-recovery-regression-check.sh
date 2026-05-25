#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

checks=(
  "dev-observer-openclaw-ai-work-view-capture-check.sh"
  "dev-observer-openclaw-ai-work-view-capture-summary-check.sh"
  "dev-observer-openclaw-ai-work-view-task-verification-summary-check.sh"
  "dev-observer-openclaw-eye-hand-action-evidence-check.sh"
  "dev-observer-openclaw-eye-hand-recovery-evidence-check.sh"
  "dev-observer-openclaw-eye-hand-auto-recovery-execution-check.sh"
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
  echo "==> observer eye-hand recovery regression: $check"
  run_child_check "$SCRIPT_DIR/$check"
done

echo '{"observerOpenClawEyeHandRecoveryRegression":{"status":"passed","checks":6}}'
