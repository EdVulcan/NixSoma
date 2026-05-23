#!/usr/bin/env bash
set -euo pipefail
PHASE9_CHECK_KIND=provider-adapter-exit PHASE9_OBSERVER_CHECK=true PHASE9_PORT_BASE=7640 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-provider-common-check.sh"
