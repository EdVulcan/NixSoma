#!/usr/bin/env bash
set -euo pipefail
PHASE10_CHECK_KIND=provider-egress-contract PHASE10_OBSERVER_CHECK=true PHASE10_PORT_BASE=7750 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-real-provider-common-check.sh"
