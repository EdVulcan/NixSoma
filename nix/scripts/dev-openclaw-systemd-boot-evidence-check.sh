#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_SYSTEMD_BOOT_EVIDENCE_CHECK_KIND=core \
  bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-systemd-boot-evidence-common-check.sh"
