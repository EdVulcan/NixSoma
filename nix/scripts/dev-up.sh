#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ARTIFACT_DIR="$REPO_ROOT/.artifacts"
OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$ARTIFACT_DIR/openclaw-events.jsonl}"
OPENCLAW_EVENT_HUB_TOKEN="${OPENCLAW_EVENT_HUB_TOKEN:-$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')}"

mkdir -p "$ARTIFACT_DIR"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-wait-helper.sh"

NODE_EXE="${NODE_EXE:-$(command -v node || true)}"
if [[ -z "$NODE_EXE" ]]; then
  echo "Unable to locate node." >&2
  exit 1
fi

DEV_BIND_HOST="${OPENCLAW_DEV_BIND_HOST:-127.0.0.1}"
if [[ -z "${OPENCLAW_BROWSER_RUNTIME_AUTH_TOKEN:-}" && "$DEV_BIND_HOST" != "127.0.0.1" && "$DEV_BIND_HOST" != "::1" && "$DEV_BIND_HOST" != "localhost" ]]; then
  OPENCLAW_BROWSER_RUNTIME_AUTH_TOKEN="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
fi
CORE_PORT="${OPENCLAW_CORE_PORT:-4100}"
EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-4101}"
SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-4102}"
BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-4103}"
SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-4104}"
SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-4105}"
SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-4106}"
SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-4107}"
OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-4170}"

sanitize_run_id() {
  local raw="$1"
  printf '%s' "$raw" | tr -c 'A-Za-z0-9_.-' '-'
}

OPENCLAW_DEV_RUN_ID_EXPLICIT="${OPENCLAW_DEV_RUN_ID+x}"
OPENCLAW_DEV_STATE_FILE_EXPLICIT="${OPENCLAW_DEV_STATE_FILE+x}"
OPENCLAW_DEV_RUN_ID="$(sanitize_run_id "${OPENCLAW_DEV_RUN_ID:-ports-$CORE_PORT}")"
OPENCLAW_BROWSER_RUNTIME_STATE_FILE="${OPENCLAW_BROWSER_RUNTIME_STATE_FILE:-$ARTIFACT_DIR/openclaw-browser-runtime-$OPENCLAW_DEV_RUN_ID.json}"
OPENCLAW_BROWSER_ENGINE_MODE="${OPENCLAW_BROWSER_ENGINE_MODE:-simulated}"
OPENCLAW_BROWSER_PROFILE_DIR="${OPENCLAW_BROWSER_PROFILE_DIR:-$ARTIFACT_DIR/openclaw-browser-profile-$OPENCLAW_DEV_RUN_ID}"
if [[ -n "$OPENCLAW_DEV_STATE_FILE_EXPLICIT" ]]; then
  STATE_FILE="$OPENCLAW_DEV_STATE_FILE"
elif [[ -n "$OPENCLAW_DEV_RUN_ID_EXPLICIT" ]]; then
  STATE_FILE="$ARTIFACT_DIR/dev-services-unix-$OPENCLAW_DEV_RUN_ID.tsv"
else
  STATE_FILE="$ARTIFACT_DIR/dev-services-unix.tsv"
fi

use_scoped_service_artifacts() {
  [[ -n "$OPENCLAW_DEV_RUN_ID_EXPLICIT" || -n "$OPENCLAW_DEV_STATE_FILE_EXPLICIT" ]]
}

service_pid_file() {
  local name="$1"
  if use_scoped_service_artifacts; then
    echo "$ARTIFACT_DIR/$OPENCLAW_DEV_RUN_ID-$name.pid"
  else
    echo "$ARTIFACT_DIR/$name.pid"
  fi
}

service_log_file() {
  local name="$1"
  if use_scoped_service_artifacts; then
    echo "$ARTIFACT_DIR/$OPENCLAW_DEV_RUN_ID-$name.log"
  else
    echo "$ARTIFACT_DIR/$name.log"
  fi
}

CORE_URL="http://127.0.0.1:$CORE_PORT"
EVENT_HUB_URL="http://127.0.0.1:$EVENT_HUB_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$SESSION_MANAGER_PORT"
BROWSER_RUNTIME_URL="http://127.0.0.1:$BROWSER_RUNTIME_PORT"
SCREEN_SENSE_URL="http://127.0.0.1:$SCREEN_SENSE_PORT"
SCREEN_ACT_URL="http://127.0.0.1:$SCREEN_ACT_PORT"
SYSTEM_SENSE_URL="http://127.0.0.1:$SYSTEM_SENSE_PORT"
SYSTEM_HEAL_URL="http://127.0.0.1:$SYSTEM_HEAL_PORT"
OBSERVER_UI_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

wait_health() {
  local url="$1"
  local timeout="${2:-30}"
  openclaw_wait_for_http_up "$url" "$timeout" 0.4
}

find_listener_pid() {
  local port="$1"
  local pid=""
  if command -v ss >/dev/null 2>&1; then
    pid="$(
      {
        ss -ltnpH "( sport = :$port )" 2>/dev/null
        if command -v sudo >/dev/null 2>&1; then
          sudo -n ss -ltnpH "( sport = :$port )" 2>/dev/null || true
        fi
      } \
        | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' \
        | head -n 1
    )"
  fi
  if [[ -z "$pid" ]] && command -v netstat >/dev/null 2>&1; then
    pid="$(netstat -ltnp 2>/dev/null | awk -v port=":$port" '$4 ~ port { split($7, parts, "/"); if (parts[1] ~ /^[0-9]+$/) { print parts[1]; exit } }' || true)"
  fi
  if [[ -z "$pid" ]] && command -v netstat >/dev/null 2>&1; then
    pid="$(netstat -ano 2>/dev/null | awk -v port=":$port" '$0 ~ port && ($0 ~ /LISTEN/ || $0 ~ /BOUND/) { print $NF; exit }' || true)"
  fi
  echo "$pid"
}

is_managed_service_pid() {
  local pid="$1"
  local cmdline=""
  local cwd=""

  if [[ -z "$pid" ]] || { ! kill -0 "$pid" >/dev/null 2>&1 && ! { command -v sudo >/dev/null 2>&1 && sudo -n kill -0 "$pid" >/dev/null 2>&1; }; }; then
    return 1
  fi

  cmdline="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  if [[ -z "$cmdline" ]] && ps -W -f >/dev/null 2>&1; then
    cmdline="$(ps -W -f 2>/dev/null | awk -v pid="$pid" '$2 == pid { $1=$2=$3=$4=$5=""; sub(/^[[:space:]]+/, ""); print; exit }' || true)"
  fi
  cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  if [[ -z "$cwd" ]] && command -v sudo >/dev/null 2>&1; then
    cwd="$(sudo -n readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  fi

  if [[ "$cwd" == "$REPO_ROOT"/services/* ]] || [[ "$cwd" == "$REPO_ROOT"/apps/* ]]; then
    [[ "$cmdline" == *"src/server.mjs"* ]]
    return $?
  fi

  # Git Bash on Windows may not expose /proc/$pid/cwd, and node is started
  # from each service directory as `node src/server.mjs`.
  if [[ -z "$cwd" ]] && [[ "$cmdline" == *"src/server.mjs"* ]] && { [[ "$cmdline" == *"node"* ]] || [[ "$cmdline" == *"nohup"* ]]; }; then
    return 0
  fi

  [[ "$cmdline" == *"$REPO_ROOT"* ]] && [[ "$cmdline" == *"src/server.mjs"* ]]
}

terminate_pid() {
  local pid="$1"
  kill "$pid" >/dev/null 2>&1 && return 0
  if command -v taskkill.exe >/dev/null 2>&1; then
    taskkill.exe //PID "$pid" //T //F >/dev/null 2>&1 && return 0
  fi
  if command -v sudo >/dev/null 2>&1; then
    sudo -n kill "$pid" >/dev/null 2>&1 && return 0
  fi
  return 1
}

kill_listener_on_port() {
  local port="$1"
  local pid=""
  pid="$(find_listener_pid "$port")"
  if is_managed_service_pid "$pid"; then
    terminate_pid "$pid" || true
    wait_port_released "$port" || true
  fi
}

port_released() {
  local port="$1"
  [[ -z "$(find_listener_pid "$port")" ]]
}

wait_port_released() {
  local port="$1"
  openclaw_wait_until 5 0.2 port_released "$port"
}

print_health_failure_debug() {
  local name="$1"
  local port="$2"
  local health_url="$3"
  local log_file
  local pid_file
  local pid=""
  log_file="$(service_log_file "$name")"
  pid_file="$(service_pid_file "$name")"

  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file" 2>/dev/null || true)"
  fi

  echo "Health check failed for $name at $health_url" >&2
  if [[ -n "$pid" ]]; then
    if kill -0 "$pid" >/dev/null 2>&1; then
      echo "Process $pid is still running." >&2
      ps -p "$pid" -o pid=,ppid=,etime=,%cpu=,%mem=,args= >&2 || true
    else
      echo "Process $pid is not running." >&2
    fi
  fi

  echo "Listener status for port $port:" >&2
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "( sport = :$port )" >&2 || true
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ano 2>/dev/null | awk -v port=":$port" '$0 ~ port { print }' >&2 || true
  else
    echo "No ss or netstat available for listener diagnostics." >&2
  fi

  if [[ -f "$log_file" ]]; then
    echo "Last log lines from $log_file:" >&2
    tail -n 40 "$log_file" >&2 || true
  else
    echo "No log file found at $log_file" >&2
  fi
}

start_service_process() {
  local name="$1"
  local working_dir="$2"
  local pid_file
  local log_file
  pid_file="$(service_pid_file "$name")"
  log_file="$(service_log_file "$name")"

  rm -f "$pid_file" "$log_file"
  (
    cd "$working_dir"
    export OPENCLAW_CORE_HOST="$DEV_BIND_HOST"
    export OPENCLAW_EVENT_HUB_HOST="$DEV_BIND_HOST"
    export OPENCLAW_SESSION_MANAGER_HOST="$DEV_BIND_HOST"
    export OPENCLAW_BROWSER_RUNTIME_HOST="$DEV_BIND_HOST"
    export OPENCLAW_SCREEN_SENSE_HOST="$DEV_BIND_HOST"
    export OPENCLAW_SCREEN_ACT_HOST="$DEV_BIND_HOST"
    export OPENCLAW_SYSTEM_SENSE_HOST="$DEV_BIND_HOST"
    export OPENCLAW_SYSTEM_HEAL_HOST="$DEV_BIND_HOST"
    export OBSERVER_UI_HOST="$DEV_BIND_HOST"
    export OPENCLAW_CORE_PORT="$CORE_PORT"
    export OPENCLAW_EVENT_HUB_PORT="$EVENT_HUB_PORT"
    export OPENCLAW_SESSION_MANAGER_PORT="$SESSION_MANAGER_PORT"
    export OPENCLAW_BROWSER_RUNTIME_PORT="$BROWSER_RUNTIME_PORT"
    export OPENCLAW_SCREEN_SENSE_PORT="$SCREEN_SENSE_PORT"
    export OPENCLAW_SCREEN_ACT_PORT="$SCREEN_ACT_PORT"
    export OPENCLAW_SYSTEM_SENSE_PORT="$SYSTEM_SENSE_PORT"
    export OPENCLAW_SYSTEM_HEAL_PORT="$SYSTEM_HEAL_PORT"
    export OBSERVER_UI_PORT="$OBSERVER_UI_PORT"
    export OPENCLAW_CORE_URL="$CORE_URL"
    export OPENCLAW_EVENT_HUB_URL="$EVENT_HUB_URL"
    export OPENCLAW_SESSION_MANAGER_URL="$SESSION_MANAGER_URL"
    export OPENCLAW_BROWSER_RUNTIME_URL="$BROWSER_RUNTIME_URL"
    export OPENCLAW_BROWSER_RUNTIME_STATE_FILE="$OPENCLAW_BROWSER_RUNTIME_STATE_FILE"
    export OPENCLAW_BROWSER_ENGINE_MODE="$OPENCLAW_BROWSER_ENGINE_MODE"
    export OPENCLAW_BROWSER_ALLOW_LOCAL_FIXTURES="${OPENCLAW_BROWSER_ALLOW_LOCAL_FIXTURES:-}"
    export OPENCLAW_BROWSER_EXECUTABLE="${OPENCLAW_BROWSER_EXECUTABLE:-}"
    export OPENCLAW_BROWSER_PROFILE_DIR="$OPENCLAW_BROWSER_PROFILE_DIR"
    export OPENCLAW_SCREEN_SENSE_URL="$SCREEN_SENSE_URL"
    export OPENCLAW_SCREEN_ACT_URL="$SCREEN_ACT_URL"
    export OPENCLAW_SYSTEM_SENSE_URL="$SYSTEM_SENSE_URL"
    export OPENCLAW_SYSTEM_HEAL_URL="$SYSTEM_HEAL_URL"
    export OPENCLAW_TRUSTED_SIDECAR_LAUNCHER_MODE="${OPENCLAW_TRUSTED_SIDECAR_LAUNCHER_MODE:-direct-spawn}"
    export OPENCLAW_TRUSTED_SIDECAR_UNIT_INSTANCE="${OPENCLAW_TRUSTED_SIDECAR_UNIT_INSTANCE:-primary}"
    export OPENCLAW_EVENT_LOG_FILE="$OPENCLAW_EVENT_LOG_FILE"
    export OPENCLAW_EVENT_HUB_TOKEN="$OPENCLAW_EVENT_HUB_TOKEN"
    export OPENCLAW_BROWSER_RUNTIME_AUTH_TOKEN="${OPENCLAW_BROWSER_RUNTIME_AUTH_TOKEN:-}"
    export OPENCLAW_SYSTEM_ALLOWED_ROOTS="${OPENCLAW_SYSTEM_ALLOWED_ROOTS:-$REPO_ROOT:$ARTIFACT_DIR:$working_dir}"
    nohup "$NODE_EXE" src/server.mjs >"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )
}

services=(
  "openclaw-event-hub|$REPO_ROOT/services/openclaw-event-hub|$EVENT_HUB_URL/health|$EVENT_HUB_PORT"
  "openclaw-core|$REPO_ROOT/services/openclaw-core|$CORE_URL/health|$CORE_PORT"
  "openclaw-session-manager|$REPO_ROOT/services/openclaw-session-manager|$SESSION_MANAGER_URL/health|$SESSION_MANAGER_PORT"
  "openclaw-browser-runtime|$REPO_ROOT/services/openclaw-browser-runtime|$BROWSER_RUNTIME_URL/health|$BROWSER_RUNTIME_PORT"
  "openclaw-screen-sense|$REPO_ROOT/services/openclaw-screen-sense|$SCREEN_SENSE_URL/health|$SCREEN_SENSE_PORT"
  "openclaw-screen-act|$REPO_ROOT/services/openclaw-screen-act|$SCREEN_ACT_URL/health|$SCREEN_ACT_PORT"
  "openclaw-system-sense|$REPO_ROOT/services/openclaw-system-sense|$SYSTEM_SENSE_URL/health|$SYSTEM_SENSE_PORT"
  "openclaw-system-heal|$REPO_ROOT/services/openclaw-system-heal|$SYSTEM_HEAL_URL/health|$SYSTEM_HEAL_PORT"
  "observer-ui|$REPO_ROOT/apps/observer-ui|$OBSERVER_UI_URL/health|$OBSERVER_UI_PORT"
)

if [[ "${OPENCLAW_DEV_SERVICES_ALREADY_UP:-false}" == "true" ]]; then
  for entry in "${services[@]}"; do
    IFS="|" read -r name _working_dir health_url _port <<<"$entry"
    if ! wait_health "$health_url" 5; then
      echo "Expected reusable OpenClaw dev service to be healthy: $name at $health_url" >&2
      exit 1
    fi
  done
  echo "Reusing already-running OpenClaw dev services."
  echo "Run id: $OPENCLAW_DEV_RUN_ID"
  echo "State file: $STATE_FILE"
  exit 0
fi

: >"$STATE_FILE"
if [[ "${OPENCLAW_BROWSER_RUNTIME_PRESERVE_STATE:-false}" != "true" ]]; then
  rm -f "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE" "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE.tmp-"*
  rm -rf "$OPENCLAW_BROWSER_PROFILE_DIR"
fi

for entry in "${services[@]}"; do
  IFS="|" read -r name working_dir health_url port <<<"$entry"
  echo "Starting $name ..."
  success=0
  for attempt in 1 2; do
    kill_listener_on_port "$port"
    start_service_process "$name" "$working_dir"
    pid="$(cat "$(service_pid_file "$name")" 2>/dev/null || true)"

    if wait_health "$health_url"; then
      success=1
      break
    fi

    print_health_failure_debug "$name" "$port" "$health_url"
    if [[ "$attempt" -lt 2 ]]; then
      echo "Retrying $name startup..." >&2
      if is_managed_service_pid "$pid"; then
        terminate_pid "$pid" || true
        wait_port_released "$port" || true
      fi
    fi
  done

  if [[ "$success" -ne 1 ]]; then
    exit 1
  fi

  printf '%s\t%s\t%s\t%s\n' "$name" "$pid" "$working_dir" "$health_url" >>"$STATE_FILE"
  echo "$name is ready."
done

echo
echo "All services are up."
echo "Run id: $OPENCLAW_DEV_RUN_ID"
echo "State file: $STATE_FILE"
