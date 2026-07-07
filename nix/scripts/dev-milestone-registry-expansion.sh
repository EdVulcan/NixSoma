#!/usr/bin/env bash

openclaw_milestone_expanded_registry_file=""

openclaw_milestone_prepare_expanded_registry() {
  local script_dir="$1"
  local source_registry_file="$2"
  local result_var="$3"

  openclaw_milestone_expanded_registry_file="$(mktemp)"
  "$script_dir/dev-milestone-expanded-registry.sh" "$source_registry_file" > "$openclaw_milestone_expanded_registry_file"
  printf -v "$result_var" '%s' "$openclaw_milestone_expanded_registry_file"
}

openclaw_milestone_cleanup_expanded_registry() {
  if [[ -n "${openclaw_milestone_expanded_registry_file:-}" ]]; then
    rm -f "$openclaw_milestone_expanded_registry_file"
  fi
}
