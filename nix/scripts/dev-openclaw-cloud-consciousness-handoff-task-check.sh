#!/usr/bin/env bash
set -euo pipefail
PHASE8_CHECK_KIND=handoff-task PHASE8_PORT_BASE=7360 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-common-check.sh"
