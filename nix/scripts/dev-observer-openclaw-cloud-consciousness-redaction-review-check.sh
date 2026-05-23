#!/usr/bin/env bash
set -euo pipefail
PHASE8_CHECK_KIND=redaction-review PHASE8_OBSERVER_CHECK=true PHASE8_PORT_BASE=7430 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-common-check.sh"
