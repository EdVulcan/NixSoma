#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATE_FILE="$REPO_ROOT/.artifacts/dev-services-unix.tsv"

ports=(
  4100 4101 4102 4103 4104 4105 4106 4107 4170
  "${OPENCLAW_CORE_PORT:-}"
  "${OPENCLAW_EVENT_HUB_PORT:-}"
  "${OPENCLAW_SESSION_MANAGER_PORT:-}"
  "${OPENCLAW_BROWSER_RUNTIME_PORT:-}"
  "${OPENCLAW_SCREEN_SENSE_PORT:-}"
  "${OPENCLAW_SCREEN_ACT_PORT:-}"
  "${OPENCLAW_SYSTEM_SENSE_PORT:-}"
  "${OPENCLAW_SYSTEM_HEAL_PORT:-}"
  "${OBSERVER_UI_PORT:-}"
)

find_listener_pid() {
  local port="$1"
  {
    ss -ltnpH "( sport = :$port )" 2>/dev/null
    if command -v sudo >/dev/null 2>&1; then
      sudo -n ss -ltnpH "( sport = :$port )" 2>/dev/null || true
    fi
  } \
    | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' \
    | head -n 1
}

wait_port_released() {
  local port="$1"
  local deadline=$((SECONDS + 5))
  while (( SECONDS < deadline )); do
    if [[ -z "$(find_listener_pid "$port")" ]]; then
      return 0
    fi
    sleep 0.2
  done
  return 1
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
  if [[ -z "$cwd" ]] && command -v sudo >/dev/null 2>&1; then
    cwd="$(sudo -n readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  fi

  if [[ "$cwd" == "$REPO_ROOT"/services/* ]] || [[ "$cwd" == "$REPO_ROOT"/apps/* ]]; then
    [[ "$cmdline" == *"src/server.mjs"* ]]
    return $?
  fi

  [[ "$cmdline" == *"$REPO_ROOT"* ]] && [[ "$cmdline" == *"src/server.mjs"* ]]
}

if [[ ! -f "$STATE_FILE" ]]; then
  echo "No unix dev state file found at $STATE_FILE"
else
  while IFS=$'\t' read -r name pid _rest; do
    if is_managed_service_pid "${pid:-}"; then
      kill "$pid" >/dev/null 2>&1 || true
      echo "Stopped $name (PID $pid)"
    fi
  done <"$STATE_FILE"

  rm -f "$STATE_FILE"
fi

for port in "${ports[@]}"; do
  if [[ -z "$port" ]]; then
    continue
  fi
  pid="$(find_listener_pid "$port")"
  if is_managed_service_pid "$pid"; then
    kill "$pid" >/dev/null 2>&1 || true
    echo "Stopped listener on port $port (PID $pid)"
    wait_port_released "$port" >/dev/null 2>&1 || true
  fi
done

while read -r pid; do
  if is_managed_service_pid "$pid"; then
    kill "$pid" >/dev/null 2>&1 || true
    echo "Stopped stale managed service (PID $pid)"
  fi
done < <(pgrep -f 'src/server\.mjs' 2>/dev/null || true)

for port in "${ports[@]}"; do
  if [[ -n "$port" ]]; then
    wait_port_released "$port" >/dev/null 2>&1 || true
  fi
done

echo "Unix dev services stopped."
