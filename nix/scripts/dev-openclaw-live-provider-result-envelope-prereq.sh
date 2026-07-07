#!/usr/bin/env bash

openclaw_result_envelope_clear_target_state() {
  local target_core_state="$1"
  local target_system_heal_state="$2"

  rm -f "$target_core_state" "$target_core_state.tmp" "$target_system_heal_state" "$target_system_heal_state.tmp"
}

openclaw_result_envelope_load_fast_prereq_helper() {
  local script_dir="$1"

  if [[ -f "$script_dir/dev-openclaw-fast-prereq-state.sh" ]]; then
    # shellcheck source=/dev/null
    source "$script_dir/dev-openclaw-fast-prereq-state.sh"
  fi
}

openclaw_result_envelope_prepare_prereq_state() {
  local script_dir="$1"
  local source_core_state="$2"
  local source_system_heal_state="$3"
  local target_core_state="$4"
  local target_system_heal_state="$5"
  local prereq_name="$6"
  local expected_registry="$7"
  local expected_marker="$8"
  local fallback_port_base_env="$9"
  local fallback_common_check="${10}"

  openclaw_result_envelope_clear_target_state "$target_core_state" "$target_system_heal_state"
  openclaw_result_envelope_load_fast_prereq_helper "$script_dir"

  if ! declare -F openclaw_reuse_prereq_state >/dev/null \
    || ! openclaw_reuse_prereq_state \
      "$source_core_state" \
      "$source_system_heal_state" \
      "$target_core_state" \
      "$target_system_heal_state" \
      "$prereq_name" \
      "$expected_registry" \
      "$expected_marker"; then
    env "$fallback_port_base_env=$PORT_BASE" \
      OPENCLAW_CORE_STATE_FILE="$target_core_state" \
      OPENCLAW_SYSTEM_HEAL_STATE_FILE="$target_system_heal_state" \
      bash "$script_dir/$fallback_common_check" >/dev/null
  fi
}
