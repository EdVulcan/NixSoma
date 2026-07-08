#!/usr/bin/env bash

openclaw_host_mutation_validation_allowed() {
  [[ "${OPENCLAW_ALLOW_HOST_MUTATION_MILESTONE:-false}" == "true" \
    || "${OPENCLAW_ALLOW_REAL_SYSTEMD_EXECUTION:-false}" == "true" ]]
}

openclaw_require_host_mutation_validation() {
  local context="${1:-This milestone path requests real host mutation.}"

  if openclaw_host_mutation_validation_allowed; then
    return 0
  fi

  cat >&2 <<EOF
Refusing real host-mutation milestone path by default: $context
This validation would request systemd execution and may trigger a desktop password prompt.
Run it only on an intentional noninteractive VM lane with:
  OPENCLAW_ALLOW_HOST_MUTATION_MILESTONE=true
EOF
  return 3
}

openclaw_guard_systemd_execute_payload() {
  local url="$1"
  local payload="$2"

  case "$url" in
    */system/systemd/*)
      case "$payload" in
        *'"execute":true'*|*'"execute": true'*)
          openclaw_require_host_mutation_validation "POST $url with execute:true"
          ;;
      esac
      ;;
  esac
}

openclaw_guard_systemd_execute_url() {
  local url="$1"

  case "$url" in
    */system/systemd/*execute=true*|*/system/systemd/*execute%3Dtrue*)
      openclaw_require_host_mutation_validation "request $url"
      ;;
  esac
}
