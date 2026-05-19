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

for check in "${checks[@]}"; do
  echo "==> observer eye-hand recovery regression: $check"
  bash "$SCRIPT_DIR/$check"
done

echo '{"observerOpenClawEyeHandRecoveryRegression":{"status":"passed","checks":6}}'
