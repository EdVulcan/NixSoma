#!/usr/bin/env bash

openclaw_dev_services_already_up() {
  [[ "${OPENCLAW_DEV_SERVICES_ALREADY_UP:-false}" == "true" ]]
}

openclaw_dev_keep_services_up() {
  [[ "${OPENCLAW_DEV_SERVICES_KEEP_UP:-false}" == "true" ]]
}

openclaw_dev_down_before_check() {
  local script_dir="$1"
  if openclaw_dev_services_already_up; then
    echo "Reusing already-running OpenClaw dev services; skipping pre-check shutdown."
    return 0
  fi

  "$script_dir/dev-down.sh" >/dev/null 2>&1 || true
}

openclaw_dev_up_for_check() {
  local script_dir="$1"
  if openclaw_dev_services_already_up; then
    echo "Reusing already-running OpenClaw dev services; skipping startup."
    return 0
  fi

  "$script_dir/dev-up.sh"
}

openclaw_dev_cleanup_for_check() {
  local script_dir="$1"
  if openclaw_dev_keep_services_up; then
    echo "Keeping OpenClaw dev services up for batch validation."
    return 0
  fi

  "$script_dir/dev-down.sh" >/dev/null 2>&1 || true
}
