#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

checks=(
  "dev-body-config-check.sh"
  "dev-openclaw-eye-hand-recovery-regression-check.sh"
  "dev-openclaw-system-health-self-heal-evidence-check.sh"
  "dev-openclaw-mvp-route-alignment-check.sh"
)

for check in "${checks[@]}"; do
  echo "==> MVP readiness: $check"
  bash "$SCRIPT_DIR/$check"
done

echo '{"openclawMvpReadiness":{"status":"passed","checks":4,"mainline":"body-eyes-hands-observer-recovery-self-heal"}}'
