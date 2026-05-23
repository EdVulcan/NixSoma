#!/usr/bin/env bash
set -euo pipefail
PHASE10_CHECK_KIND=provider-response-readback PHASE10_OBSERVER_CHECK=true PHASE10_PORT_BASE=7810 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-real-provider-common-check.sh"
