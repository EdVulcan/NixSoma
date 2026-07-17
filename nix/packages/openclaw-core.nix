{ lib, stdenvNoCC }:

let
  mkOpenClawSourceClosure = import ../lib/mk-openclaw-source-closure.nix {
    inherit lib stdenvNoCC;
  };
  coreRuntimeModules = lib.fileset.fileFilter
    (file: file.hasExt "mjs")
    ../../services/openclaw-core/src;
in
mkOpenClawSourceClosure {
  pname = "openclaw-core";
  files = [
    ../../services/openclaw-core/package.json
    coreRuntimeModules
    ../../packages/plugin-runtime/package.json
    ../../packages/plugin-runtime/src/plugin-capability-descriptors.mjs
    ../../packages/plugin-runtime/src/plugin-contract.mjs
    ../../packages/plugin-runtime/src/plugin-registry.mjs
    ../../packages/plugin-runtime/src/plugin-registry-generation-store.mjs
    ../../packages/shared-client/package.json
    ../../packages/shared-client/src/service-descriptors.mjs
    ../../packages/shared-events/src/event-factory.mjs
    ../../packages/shared-events/src/event-names.mjs
    ../../packages/shared-utils/package.json
    ../../packages/shared-utils/src/http.mjs
    ../../packages/shared-utils/src/execution-grants.mjs
    ../../packages/shared-utils/src/persist.mjs
    ../../packages/shared-utils/src/work-view-input-evidence.mjs
    ../../packages/shared-utils/src/work-view-semantic-targets.mjs
    ../../packages/shared-utils/src/work-view-visual-frame.mjs
    ../../packages/shared-systemd/src/openclaw-hostd-capabilities.json
    ../../packages/shared-systemd/src/openclaw-hostd-capabilities.mjs
  ];
}
