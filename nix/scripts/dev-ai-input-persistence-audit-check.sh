#!/usr/bin/env bash
set -euo pipefail

if (( EUID != 0 )); then
  printf 'AI input persistence audit must run as root after the live type proof\n' >&2
  exit 77
fi

AUDIT_USER="${NIXSOMA_AI_AUDIT_USER:-${SUDO_USER:-}}"
if [[ -z "$AUDIT_USER" || "$AUDIT_USER" == "root" || "$AUDIT_USER" == */* ]]; then
  printf 'NIXSOMA_AI_AUDIT_USER or SUDO_USER must name the login user\n' >&2
  exit 64
fi

AUDIT_HOME="$(getent passwd "$AUDIT_USER" | cut -d: -f6)"
if [[ -z "$AUDIT_HOME" || ! -d "$AUDIT_HOME" ]]; then
  printf 'Could not resolve the audit home for %s\n' "$AUDIT_USER" >&2
  exit 64
fi

TYPE_CANARY="NXS4L4P729Q"
TYPE_CANARY_SHA256="$(printf '%s' "$TYPE_CANARY" | sha256sum | cut -d' ' -f1)"
TARGETS=(
  /var/lib/openclaw
  /var/log/openclaw
  "$AUDIT_HOME/.local/state/openclaw"
  "$AUDIT_HOME/.local/state/log/openclaw"
  "$AUDIT_HOME/.mozilla"
  "$AUDIT_HOME/.cache/mozilla"
)

matches=()
files_scanned=0
roots_checked=0
for target in "${TARGETS[@]}"; do
  [[ -d "$target" ]] || continue
  ((roots_checked += 1))
  while IFS= read -r -d '' file; do
    ((files_scanned += 1))
    if [[ ! -r "$file" ]]; then
      printf 'AI input persistence audit cannot read %s\n' "$file" >&2
      exit 1
    fi
    if grep -a -F -q -- "$TYPE_CANARY" "$file"; then
      matches+=("$file")
    else
      grep_status="$?"
      if (( grep_status > 1 )); then
        printf 'AI input persistence audit could not inspect %s\n' "$file" >&2
        exit 1
      fi
    fi
  done < <(find "$target" -xdev -type f -print0)
done

set +e
journalctl --grep="$TYPE_CANARY" --no-pager -n 1 --output=cat >/dev/null 2>&1
journal_status="$?"
set -e
case "$journal_status" in
  0) matches+=("systemd-journal") ;;
  1) ;;
  *)
    printf 'AI input persistence audit could not inspect systemd journal\n' >&2
    exit 1
    ;;
esac

if (( ${#matches[@]} > 0 )); then
  printf 'AI input persistence audit found the write-only canary in:\n' >&2
  printf '  %s\n' "${matches[@]}" >&2
  exit 1
fi

node -e '
  console.log(JSON.stringify({
    registry: "nixsoma-ai-input-persistence-audit-v0",
    auditUser: process.argv[1],
    canarySha256: process.argv[2],
    persistentRootsChecked: Number(process.argv[3]),
    filesScanned: Number(process.argv[4]),
    journalChecked: true,
    plaintextCanaryPersisted: false,
    rootRequired: true,
  }, null, 2));
' "$AUDIT_USER" "$TYPE_CANARY_SHA256" "$roots_checked" "$files_scanned"
