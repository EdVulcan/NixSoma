#!/usr/bin/env bash
set -euo pipefail

bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-live-provider-result-envelope-wrapper.sh" 120 core
