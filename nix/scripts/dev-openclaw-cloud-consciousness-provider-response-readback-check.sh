#!/usr/bin/env bash
set -euo pipefail
PHASE10_CHECK_KIND=provider-response-readback PHASE10_PORT_BASE=7720 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-real-provider-common-check.sh"
