#!/usr/bin/env bash
set -euo pipefail

PHASE98_PORT_BASE=24700 bash "$(dirname "${BASH_SOURCE[0]}")/dev-p98-common-check.sh"
