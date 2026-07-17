#!/usr/bin/env bash

OPENCLAW_HTTP_JSON_HELPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$OPENCLAW_HTTP_JSON_HELPER_DIR/dev-openclaw-host-mutation-guard.sh"

openclaw_read_operator_token() {
  local operator_token_file="${OPENCLAW_OPERATOR_TOKEN_FILE:-$OPENCLAW_HTTP_JSON_HELPER_DIR/../../.artifacts/openclaw-operator-token}"
  local operator_token=""

  if [[ -s "$operator_token_file" ]]; then
    operator_token="$(tr -d '\r\n' <"$operator_token_file")"
  else
    operator_token="${OPENCLAW_OPERATOR_TOKEN:-}"
  fi
  printf '%s' "$operator_token"
}

openclaw_curl_is_core_read() {
  local method="GET"
  local has_body=0
  local is_core_url=0
  local argument=""
  local next_argument_is_method=0
  local core_port="${OPENCLAW_CORE_PORT:-4100}"

  for argument in "$@"; do
    if (( next_argument_is_method )); then
      method="${argument^^}"
      next_argument_is_method=0
      continue
    fi
    case "$argument" in
      -X|--request)
        next_argument_is_method=1
        ;;
      -X?*)
        method="${argument:2}"
        method="${method^^}"
        ;;
      --data|--data-raw|--data-binary|--data-urlencode|-d|-F|--form|--form-string)
        has_body=1
        ;;
      "http://127.0.0.1:$core_port"/*|"http://localhost:$core_port"/*|"http://[::1]:$core_port"/*)
        is_core_url=1
        ;;
    esac
  done

  [[ "$method" == "GET" && "$has_body" == "0" && "$is_core_url" == "1" ]]
}

# Existing milestone scripts use direct curl for readback. Keep their call sites
# small while ensuring newly protected Core read models carry operator identity.
openclaw_execute_curl() {
  command curl "$@"
}

openclaw_curl() {
  local curl_args=("$@")
  local argument=""
  local has_authorization=0
  local lower_argument=""
  if openclaw_curl_is_core_read "$@"; then
    for argument in "${curl_args[@]}"; do
      lower_argument="${argument,,}"
      if [[ "$lower_argument" == authorization:* || "$lower_argument" == "bearer "* ]]; then
        has_authorization=1
        break
      fi
    done
    if (( ! has_authorization )); then
      local operator_token
      operator_token="$(openclaw_read_operator_token)"
      if [[ -n "$operator_token" ]]; then
        curl_args+=(-H "authorization: Bearer $operator_token")
      fi
    fi
  fi
  openclaw_execute_curl "${curl_args[@]}"
}

curl() {
  openclaw_curl "$@"
}

openclaw_post_json() {
  local url="$1"
  local payload="$2"
  local failure_mode="${OPENCLAW_POST_JSON_FAILURE:-fail}"
  local payload_mode="${OPENCLAW_POST_JSON_PAYLOAD_MODE:-data}"
  local data_flag="${OPENCLAW_POST_JSON_DATA_FLAG:---data}"
  local curl_args=(--silent)
  local operator_token
  operator_token="$(openclaw_read_operator_token)"

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
  if [[ -n "$operator_token" ]]; then
    curl_args+=(-H "authorization: Bearer $operator_token")
  fi

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

openclaw_eval_json() {
  local json="$1"
  local script="$2"

  printf '%s' "$json" | OPENCLAW_JSON_SCRIPT="$script" node -e '
    const fs = require("node:fs");
    process.argv[1] = fs.readFileSync(0, "utf8");
    eval(process.env.OPENCLAW_JSON_SCRIPT);
  '
}
