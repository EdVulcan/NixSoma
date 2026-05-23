#!/usr/bin/env bash
set -euo pipefail
PHASE8_CHECK_KIND=handoff-readback PHASE8_PORT_BASE=7380 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-common-check.sh"
