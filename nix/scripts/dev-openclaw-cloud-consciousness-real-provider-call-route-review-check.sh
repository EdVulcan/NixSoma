#!/usr/bin/env bash
set -euo pipefail
PHASE10_CHECK_KIND=real-provider-call-route-review PHASE10_PORT_BASE=7690 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-real-provider-common-check.sh"
