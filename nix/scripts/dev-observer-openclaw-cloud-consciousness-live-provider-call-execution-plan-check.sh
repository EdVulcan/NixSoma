#!/usr/bin/env bash
set -euo pipefail
PHASE12_CHECK_KIND=live-provider-call-execution-plan PHASE12_OBSERVER_CHECK=true PHASE12_PORT_BASE=8090 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-live-provider-execution-plan-common-check.sh"
