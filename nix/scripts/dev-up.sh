#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ARTIFACT_DIR="$REPO_ROOT/.artifacts"
STATE_FILE="$ARTIFACT_DIR/dev-services-unix.tsv"
OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$ARTIFACT_DIR/openclaw-events.jsonl}"

mkdir -p "$ARTIFACT_DIR"

NODE_EXE="${NODE_EXE:-$(command -v node || true)}"
if [[ -z "$NODE_EXE" ]]; then
  echo "Unable to locate node." >&2
  exit 1
fi

DEV_BIND_HOST="${OPENCLAW_DEV_BIND_HOST:-0.0.0.0}"
CORE_PORT="${OPENCLAW_CORE_PORT:-4100}"
EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-4101}"
SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-4102}"
BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-4103}"
SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-4104}"
SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-4105}"
SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-4106}"
SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-4107}"
OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-4170}"

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
  local deadline=$((SECONDS + timeout))
  while (( SECONDS < deadline )); do
    if curl --silent --fail "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.4
  done
  return 1
}

find_listener_pid() {
  local port="$1"
  ss -ltnpH "( sport = :$port )" 2>/dev/null \
    | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' \
    | head -n 1
}

is_managed_service_pid() {
  local pid="$1"
  local cmdline=""
  local cwd=""

  if [[ -z "$pid" ]] || ! kill -0 "$pid" >/dev/null 2>&1; then
    return 1
  fi

  cmdline="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"

  if [[ "$cwd" == "$REPO_ROOT"/services/* ]] || [[ "$cwd" == "$REPO_ROOT"/apps/* ]]; then
    [[ "$cmdline" == *"src/server.mjs"* ]]
    return $?
  fi

  [[ "$cmdline" == *"$REPO_ROOT"* ]] && [[ "$cmdline" == *"src/server.mjs"* ]]
}

kill_listener_on_port() {
  local port="$1"
  local pid=""
  pid="$(find_listener_pid "$port")"
  if is_managed_service_pid "$pid"; then
    kill "$pid" >/dev/null 2>&1 || true
    sleep 0.5
  fi
}

print_health_failure_debug() {
  local name="$1"
  local port="$2"
  local health_url="$3"
  local log_file="$ARTIFACT_DIR/$name.log"
  local pid_file="$ARTIFACT_DIR/$name.pid"
  local pid=""

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
  ss -ltnp "( sport = :$port )" >&2 || true

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
  local pid_file="$ARTIFACT_DIR/$name.pid"
  local log_file="$ARTIFACT_DIR/$name.log"

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
    export OPENCLAW_SCREEN_SENSE_URL="$SCREEN_SENSE_URL"
    export OPENCLAW_SCREEN_ACT_URL="$SCREEN_ACT_URL"
    export OPENCLAW_SYSTEM_SENSE_URL="$SYSTEM_SENSE_URL"
    export OPENCLAW_SYSTEM_HEAL_URL="$SYSTEM_HEAL_URL"
    export OPENCLAW_EVENT_LOG_FILE="$OPENCLAW_EVENT_LOG_FILE"
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

: >"$STATE_FILE"

for entry in "${services[@]}"; do
  IFS="|" read -r name working_dir health_url port <<<"$entry"
  echo "Starting $name ..."
  success=0
  for attempt in 1 2; do
    kill_listener_on_port "$port"
    start_service_process "$name" "$working_dir"
    pid="$(cat "$ARTIFACT_DIR/$name.pid")"

    if wait_health "$health_url"; then
      success=1
      break
    fi

    print_health_failure_debug "$name" "$port" "$health_url"
    if [[ "$attempt" -lt 2 ]]; then
      echo "Retrying $name startup..." >&2
      if is_managed_service_pid "$pid"; then
        kill "$pid" >/dev/null 2>&1 || true
        sleep 0.5
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
echo "State file: $STATE_FILE"
