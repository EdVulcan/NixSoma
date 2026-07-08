#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_FILE="${OPENCLAW_LIVE_PROVIDER_RESULT_ENVELOPE_MILESTONES_FILE:-$SCRIPT_DIR/openclaw-live-provider-result-envelope-milestones.tsv}"
PHASE="${1:?Usage: $0 <phase> <core|observer>}"
MODE="${2:?Usage: $0 <phase> <core|observer>}"

if [[ ! "$PHASE" =~ ^[0-9]+$ ]]; then
  echo "Invalid phase: $PHASE" >&2
  exit 1
fi

slug="$(
  awk -F '\t' -v phase="$PHASE" '
    $0 !~ /^#/ && NF >= 2 && $1 == phase { print $2; found = 1 }
    END { if (!found) exit 1 }
  ' "$MANIFEST_FILE"
)"

phase_env="PHASE${PHASE}"
port_base=$((14900 + (PHASE * 100)))
core_script="dev-${slug}-check.sh"
observer_script="dev-observer-${slug}-check.sh"
common_script_name="dev-${slug}-common-check.sh"
if (( PHASE >= 130 || ${#core_script} >= 240 || ${#observer_script} >= 240 || ${#common_script_name} >= 240 )); then
  common_script_name="dev-openclaw-live-provider-result-envelope-phase-${PHASE}-common-check.sh"
fi
common_script="$SCRIPT_DIR/$common_script_name"

if [[ ! -f "$common_script" ]]; then
  echo "Common milestone check not found for Phase $PHASE: $common_script" >&2
  exit 1
fi

case "$MODE" in
  core)
    env "${phase_env}_PORT_BASE=$port_base" bash "$common_script"
    ;;
  observer)
    env "${phase_env}_OBSERVER_CHECK=true" "${phase_env}_PORT_BASE=$((port_base + 20))" bash "$common_script"
    ;;
  *)
    echo "Invalid result-envelope milestone wrapper mode: $MODE" >&2
    exit 1
    ;;
esac
