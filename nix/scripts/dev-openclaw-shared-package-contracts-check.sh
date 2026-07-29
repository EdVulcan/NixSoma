#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if ! command -v tsc >/dev/null 2>&1 && [[ -x "$REPO_ROOT/node_modules/.bin/tsc" ]]; then
  export PATH="$REPO_ROOT/node_modules/.bin:$PATH"
fi

if ! command -v tsc >/dev/null 2>&1; then
  if [[ "${OPENCLAW_SHARED_PACKAGE_CONTRACTS_NIX_SHELL:-false}" != "true" ]] && command -v nix >/dev/null 2>&1; then
    OPENCLAW_SHARED_PACKAGE_CONTRACTS_NIX_SHELL=true \
      exec nix --extra-experimental-features "nix-command flakes" shell nixpkgs#typescript -c bash "$0"
  fi
  echo "TypeScript compiler not found. Enter the flake dev shell or install tsc." >&2
  exit 1
fi

cd "$REPO_ROOT"

tsc -p packages/shared-types/tsconfig.json --noEmit
tsc -p packages/shared-events/tsconfig.json --noEmit
tsc -p packages/shared-client/tsconfig.json --noEmit
tsc -p packages/shared-utils/tsconfig.json --noEmit

node --check packages/plugin-runtime/src/plugin-contract.mjs
node --check packages/plugin-runtime/src/plugin-capability-descriptors.mjs
node --check packages/plugin-runtime/src/plugin-registry.mjs
node --check packages/shared-types/src/plugin-contract.mjs
node --check packages/shared-types/src/plugin-registry.mjs
node --check packages/shared-events/src/event-factory.mjs
node --check packages/shared-events/src/event-names.mjs
node --check packages/shared-events/src/index.mjs
node --check packages/shared-client/src/service-descriptors.mjs
node --check packages/shared-client/src/index.mjs
node --check packages/shared-utils/src/http.mjs
node --check packages/shared-utils/src/persist.mjs

node --input-type=module <<'NODE'
import {
  OPENCLAW_NATIVE_PLUGIN_CONTRACT_VERSION as runtimeContractVersion,
} from "./packages/plugin-runtime/src/plugin-contract.mjs";
import {
  OPENCLAW_NATIVE_PLUGIN_CONTRACT_VERSION as shimContractVersion,
} from "./packages/shared-types/src/plugin-contract.mjs";
import {
  OPENCLAW_NATIVE_PLUGIN_REGISTRY_VERSION as runtimeRegistryVersion,
} from "./packages/plugin-runtime/src/plugin-registry.mjs";
import {
  OPENCLAW_NATIVE_PLUGIN_REGISTRY_VERSION as shimRegistryVersion,
} from "./packages/shared-types/src/plugin-registry.mjs";

if (runtimeContractVersion !== shimContractVersion) {
  throw new Error("shared-types plugin contract shim does not match plugin-runtime");
}
if (runtimeRegistryVersion !== shimRegistryVersion) {
  throw new Error("shared-types plugin registry shim does not match plugin-runtime");
}
NODE

node --test \
  packages/plugin-runtime/test/*.test.mjs \
  packages/shared-client/test/*.test.mjs \
  packages/shared-events/test/*.test.mjs \
  packages/shared-utils/test/*.test.mjs

echo "Shared package contracts validated."
