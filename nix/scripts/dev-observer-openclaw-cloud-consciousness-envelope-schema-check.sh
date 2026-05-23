#!/usr/bin/env bash
set -euo pipefail
PHASE8_CHECK_KIND=envelope-schema PHASE8_OBSERVER_CHECK=true PHASE8_PORT_BASE=7410 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-common-check.sh"
