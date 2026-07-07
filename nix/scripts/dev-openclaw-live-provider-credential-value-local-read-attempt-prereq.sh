#!/usr/bin/env bash

openclaw_credential_value_local_read_attempt_manifest_file() {
  local script_dir="$1"
  printf '%s\n' "${OPENCLAW_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_MILESTONES_FILE:-$script_dir/openclaw-live-provider-credential-value-local-read-attempt-milestones.tsv}"
}

openclaw_credential_value_local_read_attempt_slug_suffix() {
  local slug="$1"
  printf '%s\n' "${slug#openclaw-cloud-consciousness-live-provider-}"
}

openclaw_credential_value_local_read_attempt_manifest_row() {
  local script_dir="$1"
  local phase="$2"
  local manifest_file
  manifest_file="$(openclaw_credential_value_local_read_attempt_manifest_file "$script_dir")"

  awk -F '\t' -v phase="$phase" '
    $0 !~ /^#/ && NF >= 11 && $1 == phase { print; found = 1 }
    END { if (!found) exit 1 }
  ' "$manifest_file"
}

openclaw_credential_value_local_read_attempt_clear_target_state() {
  local target_core_state="$1"
  local target_system_heal_state="$2"

  rm -f "$target_core_state" "$target_core_state.tmp" "$target_system_heal_state" "$target_system_heal_state.tmp"
}

openclaw_credential_value_local_read_attempt_load_fast_prereq_helper() {
  local script_dir="$1"

  if [[ -f "$script_dir/dev-openclaw-fast-prereq-state.sh" ]]; then
    # shellcheck source=/dev/null
    source "$script_dir/dev-openclaw-fast-prereq-state.sh"
  fi
}

openclaw_credential_value_local_read_attempt_prepare_prereq_state() {
  local current_phase="${1:?Usage: openclaw_credential_value_local_read_attempt_prepare_prereq_state <phase>}"

  if [[ -z "${SCRIPT_DIR:-}" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  fi
  if [[ -z "${REPO_ROOT:-}" ]]; then
    REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
  fi

  local row
  row="$(openclaw_credential_value_local_read_attempt_manifest_row "$SCRIPT_DIR" "$current_phase")"

  local phase slug core_description observer_description predecessor_phase predecessor_slug next_slug fast_source_phase fast_source_slug prereq_registry prereq_marker
  IFS=$'\t' read -r \
    phase \
    slug \
    core_description \
    observer_description \
    predecessor_phase \
    predecessor_slug \
    next_slug \
    fast_source_phase \
    fast_source_slug \
    prereq_registry \
    prereq_marker <<< "$row"

  local fast_source_suffix
  fast_source_suffix="$(openclaw_credential_value_local_read_attempt_slug_suffix "$fast_source_slug")"
  local source_core_state="$REPO_ROOT/.artifacts/openclaw-core-phase-${fast_source_phase}-${fast_source_suffix}-check.json"
  local source_system_heal_state="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-${fast_source_phase}-${fast_source_suffix}-check.json"
  local fallback_common_check="dev-${predecessor_slug}-common-check.sh"
  local fallback_port_base_env="PHASE${predecessor_phase}_PORT_BASE"
  local prereq_name="phase-${fast_source_phase}-${fast_source_suffix}-state"

  if [[ "${OPENCLAW_DEV_SERVICES_ALREADY_UP:-false}" == "true" ]]; then
    echo "Using already-running OpenClaw dev services as the live $prereq_name prerequisite state."
    return 0
  fi

  openclaw_credential_value_local_read_attempt_clear_target_state "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE"
  openclaw_credential_value_local_read_attempt_load_fast_prereq_helper "$SCRIPT_DIR"

  if ! declare -F openclaw_reuse_prereq_state >/dev/null \
    || ! openclaw_reuse_prereq_state \
      "$source_core_state" \
      "$source_system_heal_state" \
      "$OPENCLAW_CORE_STATE_FILE" \
      "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
      "$prereq_name" \
      "$prereq_registry" \
      "$prereq_marker"; then
    env "$fallback_port_base_env=$PORT_BASE" \
      OPENCLAW_CORE_STATE_FILE="$OPENCLAW_CORE_STATE_FILE" \
      OPENCLAW_SYSTEM_HEAL_STATE_FILE="$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
      bash "$SCRIPT_DIR/$fallback_common_check" >/dev/null
  fi
}
