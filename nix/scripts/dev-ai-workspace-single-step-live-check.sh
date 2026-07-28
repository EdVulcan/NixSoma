#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The browser-scene gate owns the current task-bound single-step contract.
exec "$SCRIPT_DIR/dev-ai-browser-scene-grounding-live-check.sh" "$@"
