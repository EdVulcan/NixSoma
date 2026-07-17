#!/usr/bin/env bash
set -euo pipefail

PHASE98_OBSERVER_CHECK=true PHASE98_PORT_BASE=24720 bash "$(dirname "${BASH_SOURCE[0]}")/dev-p98-common-check.sh"
