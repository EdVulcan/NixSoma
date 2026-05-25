#!/usr/bin/env bash
set -euo pipefail
PHASE12_CHECK_KIND=live-provider-execution-transcript-schema PHASE12_PORT_BASE=8030 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-live-provider-execution-plan-common-check.sh"
