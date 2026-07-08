#!/usr/bin/env bash

OPENCLAW_RESULT_ENVELOPE_PHASE="${1:?Usage: source dev-openclaw-live-provider-result-envelope-common-env.sh <phase>}"

if [[ ! "$OPENCLAW_RESULT_ENVELOPE_PHASE" =~ ^[0-9]+$ ]]; then
  echo "Invalid result-envelope phase: $OPENCLAW_RESULT_ENVELOPE_PHASE" >&2
  return 1 2>/dev/null || exit 1
fi

if [[ -z "${SCRIPT_DIR:-}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OPENCLAW_RESULT_ENVELOPE_MANIFEST_FILE="${OPENCLAW_LIVE_PROVIDER_RESULT_ENVELOPE_MILESTONES_FILE:-$SCRIPT_DIR/openclaw-live-provider-result-envelope-milestones.tsv}"
OPENCLAW_RESULT_ENVELOPE_ASSERTIONS_HELPER="$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-assertions.sh"
if [[ -f "$OPENCLAW_RESULT_ENVELOPE_ASSERTIONS_HELPER" ]]; then
  # shellcheck source=/dev/null
  source "$OPENCLAW_RESULT_ENVELOPE_ASSERTIONS_HELPER"
fi

OPENCLAW_RESULT_ENVELOPE_SLUG="$(
  awk -F '\t' -v phase="$OPENCLAW_RESULT_ENVELOPE_PHASE" '
    $0 !~ /^#/ && NF >= 2 && $1 == phase { print $2; found = 1 }
    END { if (!found) exit 1 }
  ' "$OPENCLAW_RESULT_ENVELOPE_MANIFEST_FILE"
)"

phase_env="PHASE${OPENCLAW_RESULT_ENVELOPE_PHASE}"
observer_var="${phase_env}_OBSERVER_CHECK"
port_var="${phase_env}_PORT_BASE"
default_port_base=$((14900 + (OPENCLAW_RESULT_ENVELOPE_PHASE * 100)))
artifact_suffix="${OPENCLAW_RESULT_ENVELOPE_SLUG#openclaw-cloud-consciousness-live-provider-}"

OBSERVER_CHECK="${!observer_var:-false}"
PORT_BASE="${!port_var:-$default_port_base}"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_${OPENCLAW_RESULT_ENVELOPE_PHASE}_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-${OPENCLAW_RESULT_ENVELOPE_PHASE}-${artifact_suffix}-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-${OPENCLAW_RESULT_ENVELOPE_PHASE}-${artifact_suffix}-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
