#!/usr/bin/env bash

OPENCLAW_CORE_OBSERVER_PAIR_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

openclaw_core_observer_pair_down() {
  local run_id="$1"
  local port_base="$2"
  env \
    OPENCLAW_DEV_RUN_ID="$run_id" \
    OPENCLAW_DEV_SERVICES_KEEP_UP=false \
    OPENCLAW_DEV_SERVICES_ALREADY_UP=false \
    OPENCLAW_DEV_DOWN_FORCE=true \
    OPENCLAW_CORE_PORT="$port_base" \
    OPENCLAW_EVENT_HUB_PORT="$((port_base + 1))" \
    OPENCLAW_SESSION_MANAGER_PORT="$((port_base + 2))" \
    OPENCLAW_BROWSER_RUNTIME_PORT="$((port_base + 3))" \
    OPENCLAW_SCREEN_SENSE_PORT="$((port_base + 4))" \
    OPENCLAW_SCREEN_ACT_PORT="$((port_base + 5))" \
    OPENCLAW_SYSTEM_SENSE_PORT="$((port_base + 6))" \
    OPENCLAW_SYSTEM_HEAL_PORT="$((port_base + 7))" \
    OBSERVER_UI_PORT="$((port_base + 8))" \
      bash "$OPENCLAW_CORE_OBSERVER_PAIR_SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}

openclaw_run_core_observer_pair() {
  local label="$1"
  local common_script="$2"
  local port_var="$3"
  local observer_var="$4"
  local port_base="$5"
  shift 5

  local run_id="${OPENCLAW_CORE_OBSERVER_PAIR_RUN_ID:-core-observer-pair-$label-$$}"
  local event_log_file="${OPENCLAW_CORE_OBSERVER_PAIR_EVENT_LOG_FILE:-$OPENCLAW_CORE_OBSERVER_PAIR_SCRIPT_DIR/../../.artifacts/$run_id-events.jsonl}"
  local status=0

  openclaw_core_observer_pair_down "$run_id" "$port_base"
  if env \
    OPENCLAW_DEV_RUN_ID="$run_id" \
    OPENCLAW_EVENT_LOG_FILE="$event_log_file" \
    OPENCLAW_DEV_SERVICES_KEEP_UP=true \
    OPENCLAW_DEV_SERVICES_ALREADY_UP=false \
    "$port_var=$port_base" \
    "$observer_var=false" \
    "$@" \
      bash "$common_script"; then
    :
  else
    status=$?
  fi

  if [[ "$status" -eq 0 ]]; then
    if env \
      OPENCLAW_DEV_RUN_ID="$run_id" \
      OPENCLAW_EVENT_LOG_FILE="$event_log_file" \
      OPENCLAW_DEV_SERVICES_KEEP_UP=true \
      OPENCLAW_DEV_SERVICES_ALREADY_UP=true \
      "$port_var=$port_base" \
      "$observer_var=true" \
      "$@" \
        bash "$common_script"; then
      :
    else
      status=$?
    fi
  fi

  openclaw_core_observer_pair_down "$run_id" "$port_base"
  return "$status"
}
