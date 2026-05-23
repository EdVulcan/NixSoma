#!/usr/bin/env bash
set -euo pipefail
PHASE9_CHECK_KIND=provider-dry-run-task PHASE9_OBSERVER_CHECK=true PHASE9_PORT_BASE=7610 bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-cloud-consciousness-provider-common-check.sh"
