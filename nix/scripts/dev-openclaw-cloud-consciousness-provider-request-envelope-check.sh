#!/usr/bin/env bash
set -euo pipefail
PHASE9_CHECK_KIND=provider-request-envelope PHASE9_PORT_BASE=7510 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-provider-common-check.sh"
