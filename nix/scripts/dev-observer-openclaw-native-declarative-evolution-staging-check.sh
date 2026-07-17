#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_NATIVE_DECLARATIVE_EVOLUTION_STAGING_CHECK_KIND=observer \
OPENCLAW_NATIVE_DECLARATIVE_EVOLUTION_STAGING_OBSERVER_CHECK=true \
  bash "$(dirname "${BASH_SOURCE[0]}")/dev-openclaw-native-declarative-evolution-staging-common-check.sh"
