#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ARTIFACT_DIR="$REPO_ROOT/.artifacts"
OPENCLAW_DEV_DOWN_SCOPE="${OPENCLAW_DEV_DOWN_SCOPE:-current}"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-wait-helper.sh"

sanitize_run_id() {
  local raw="$1"
  printf '%s' "$raw" | tr -c 'A-Za-z0-9_.-' '-'
}

CORE_PORT="${OPENCLAW_CORE_PORT:-4100}"
OPENCLAW_DEV_RUN_ID_EXPLICIT="${OPENCLAW_DEV_RUN_ID+x}"
OPENCLAW_DEV_STATE_FILE_EXPLICIT="${OPENCLAW_DEV_STATE_FILE+x}"
OPENCLAW_DEV_RUN_ID="$(sanitize_run_id "${OPENCLAW_DEV_RUN_ID:-ports-$CORE_PORT}")"
if [[ -n "$OPENCLAW_DEV_STATE_FILE_EXPLICIT" ]]; then
  STATE_FILE="$OPENCLAW_DEV_STATE_FILE"
elif [[ -n "$OPENCLAW_DEV_RUN_ID_EXPLICIT" ]]; then
  STATE_FILE="$ARTIFACT_DIR/dev-services-unix-$OPENCLAW_DEV_RUN_ID.tsv"
else
  STATE_FILE="$ARTIFACT_DIR/dev-services-unix.tsv"
fi

if [[ "${OPENCLAW_DEV_SERVICES_KEEP_UP:-false}" == "true" && "${OPENCLAW_DEV_DOWN_FORCE:-false}" != "true" ]]; then
  echo "Keeping OpenClaw dev services up for batch validation."
  exit 0
fi

ports=(
  "$CORE_PORT"
  "${OPENCLAW_EVENT_HUB_PORT:-4101}"
  "${OPENCLAW_SESSION_MANAGER_PORT:-4102}"
  "${OPENCLAW_BROWSER_RUNTIME_PORT:-4103}"
  "${OPENCLAW_SCREEN_SENSE_PORT:-4104}"
  "${OPENCLAW_SCREEN_ACT_PORT:-4105}"
  "${OPENCLAW_SYSTEM_SENSE_PORT:-4106}"
  "${OPENCLAW_SYSTEM_HEAL_PORT:-4107}"
  "${OBSERVER_UI_PORT:-4170}"
)
if [[ "$OPENCLAW_DEV_DOWN_SCOPE" == "all" || "${OPENCLAW_DEV_INCLUDE_HIGH_PORT_PHASES:-false}" == "true" ]]; then
  for port in $(seq 19160 19238); do
    ports+=("$port")
  done
fi

find_listener_pid() {
  local port="$1"
  local pid=""
  if command -v ss >/dev/null 2>&1; then
    pid="$(
      {
        if command -v timeout >/dev/null 2>&1; then
          timeout 2 ss -ltnpH "( sport = :$port )" 2>/dev/null || true
        else
          ss -ltnpH "( sport = :$port )" 2>/dev/null || true
        fi
        if [[ "${OPENCLAW_DEV_DOWN_USE_SUDO_SS:-false}" == "true" ]] && command -v sudo >/dev/null 2>&1; then
          if command -v timeout >/dev/null 2>&1; then
            timeout 2 sudo -n ss -ltnpH "( sport = :$port )" 2>/dev/null || true
          else
            sudo -n ss -ltnpH "( sport = :$port )" 2>/dev/null || true
          fi
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

wait_port_released() {
  local port="$1"
  openclaw_wait_until 5 0.2 port_released "$port"
}

port_released() {
  local port="$1"
  [[ -z "$(find_listener_pid "$port")" ]]
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

state_files=("$STATE_FILE")
if [[ "$OPENCLAW_DEV_DOWN_SCOPE" == "all" ]]; then
  shopt -s nullglob
  state_files=("$ARTIFACT_DIR"/dev-services-unix.tsv "$ARTIFACT_DIR"/dev-services-unix-*.tsv)
  shopt -u nullglob
fi

for state_file in "${state_files[@]}"; do
  if [[ ! -f "$state_file" ]]; then
    continue
  fi
  while IFS=$'\t' read -r name pid _rest; do
    if is_managed_service_pid "${pid:-}"; then
      terminate_pid "$pid" || true
      echo "Stopped $name (PID $pid)"
    fi
  done <"$state_file"

  rm -f "$state_file"
done

for port in "${ports[@]}"; do
  if [[ -z "$port" ]]; then
    continue
  fi
  pid="$(find_listener_pid "$port")"
  if is_managed_service_pid "$pid"; then
    terminate_pid "$pid" || true
    echo "Stopped listener on port $port (PID $pid)"
    wait_port_released "$port" >/dev/null 2>&1 || true
  fi
done

if [[ "$OPENCLAW_DEV_DOWN_SCOPE" == "all" || "${OPENCLAW_DEV_DOWN_STALE_SCAN:-false}" == "true" ]]; then
  while read -r pid; do
    if is_managed_service_pid "$pid"; then
      terminate_pid "$pid" || true
      echo "Stopped stale managed service (PID $pid)"
    fi
  done < <(
    if command -v pgrep >/dev/null 2>&1; then
      pgrep -f 'src/server\.mjs' 2>/dev/null || true
    elif ps -W -f >/dev/null 2>&1; then
      ps -W -f 2>/dev/null | awk '/src\/server\.mjs/ && !/awk/ { print $2 }' || true
    fi
  )
fi

for port in "${ports[@]}"; do
  if [[ -n "$port" ]]; then
    wait_port_released "$port" >/dev/null 2>&1 || true
  fi
done

echo "Unix dev services stopped for scope '$OPENCLAW_DEV_DOWN_SCOPE' run '$OPENCLAW_DEV_RUN_ID'."
