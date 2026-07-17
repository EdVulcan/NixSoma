#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_NATIVE_DECLARATIVE_EVOLUTION_STAGING_CHECK_KIND=core \
  bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-native-declarative-evolution-staging-common-check.sh"
