#!/usr/bin/env bash
set -euo pipefail
PHASE9_CHECK_KIND=provider-contract PHASE9_PORT_BASE=7500 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-provider-common-check.sh"
