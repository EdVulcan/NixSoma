#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

checks=(
  "dev-observer-openclaw-eye-hand-recovery-regression-check.sh"
  "dev-observer-openclaw-system-health-self-heal-evidence-check.sh"
  "dev-observer-openclaw-mvp-route-alignment-check.sh"
)

for check in "${checks[@]}"; do
  echo "==> observer MVP readiness: $check"
  bash "$SCRIPT_DIR/$check"
done

echo '{"observerOpenClawMvpReadiness":{"status":"passed","checks":3,"mainline":"observer-visible-body-loop-readiness"}}'
