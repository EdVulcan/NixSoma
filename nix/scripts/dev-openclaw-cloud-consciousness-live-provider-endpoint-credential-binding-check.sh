#!/usr/bin/env bash
set -euo pipefail
PHASE12_CHECK_KIND=live-provider-endpoint-credential-binding PHASE12_PORT_BASE=8020 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-live-provider-execution-plan-common-check.sh"
