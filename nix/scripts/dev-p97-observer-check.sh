#!/usr/bin/env bash
set -euo pipefail

PHASE97_OBSERVER_CHECK=true PHASE97_PORT_BASE=24620 bash "$(dirname "${BASH_SOURCE[0]}")/dev-p97-common-check.sh"
