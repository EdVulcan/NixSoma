#!/usr/bin/env bash

OPENCLAW_HTTP_JSON_HELPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$OPENCLAW_HTTP_JSON_HELPER_DIR/dev-openclaw-host-mutation-guard.sh"

openclaw_post_json() {
  local url="$1"
  local payload="$2"
  local failure_mode="${OPENCLAW_POST_JSON_FAILURE:-fail}"
  local payload_mode="${OPENCLAW_POST_JSON_PAYLOAD_MODE:-data}"
  local data_flag="${OPENCLAW_POST_JSON_DATA_FLAG:---data}"
  local curl_args=(--silent)

  case "$failure_mode" in
    fail)
      curl_args+=(--fail)
      ;;
    fail-with-body)
      curl_args+=(--show-error --fail-with-body)
      ;;
    allow)
      ;;
    *)
      echo "Unknown OPENCLAW_POST_JSON_FAILURE: $failure_mode" >&2
      return 2
      ;;
  esac

  curl_args+=(-X POST "$url" -H 'content-type: application/json')

  case "$payload_mode" in
    data)
      curl_args+=("$data_flag" "$payload")
      ;;
    file)
      curl_args+=(--data-binary "@$payload")
      ;;
    *)
      echo "Unknown OPENCLAW_POST_JSON_PAYLOAD_MODE: $payload_mode" >&2
      return 2
      ;;
  esac

  if [[ "$payload_mode" == "data" ]]; then
    openclaw_guard_systemd_execute_payload "$url" "$payload" || return $?
  fi

  curl "${curl_args[@]}"
}

post_json() {
  openclaw_post_json "$@"
}
