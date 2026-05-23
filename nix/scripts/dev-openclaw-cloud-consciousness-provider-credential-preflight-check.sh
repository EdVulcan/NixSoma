#!/usr/bin/env bash
set -euo pipefail
PHASE10_CHECK_KIND=provider-credential-preflight PHASE10_PORT_BASE=7670 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-real-provider-common-check.sh"
