#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

checks=(
  "dev-openclaw-mvp-readiness-check.sh"
  "dev-observer-openclaw-mvp-readiness-check.sh"
  "dev-openclaw-mvp-status-check.sh"
  "dev-openclaw-mvp-demo-guide-check.sh"
)

for check in "${checks[@]}"; do
  echo "==> MVP release exit: $check"
  bash "$SCRIPT_DIR/$check"
done

echo '{"openclawMvpReleaseExit":{"status":"passed","stage":"first-stage-mvp-demo-ready","checks":4,"next":"phase-two-selection-from-whitepaper-route"}}'
