#!/usr/bin/env bash
set -euo pipefail
PHASE12_CHECK_KIND=approved-live-provider-execution-plan PHASE12_PORT_BASE=8060 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-live-provider-execution-plan-common-check.sh"
