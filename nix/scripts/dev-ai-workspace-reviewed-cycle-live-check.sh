#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NIXSOMA_AI_ASSESSMENT_REVIEWED_CYCLE=1 \
NIXSOMA_AI_ASSESSMENT_ACCEPT_COMPLETE=1 \
  exec bash "$SCRIPT_DIR/dev-ai-workspace-assessment-live-check.sh"
