#!/usr/bin/env bash
set -euo pipefail
PHASE12_CHECK_KIND=live-provider-execution-plan-readback PHASE12_OBSERVER_CHECK=true PHASE12_PORT_BASE=8150 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-live-provider-execution-plan-common-check.sh"
