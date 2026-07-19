{ lib, buildNpmPackage, fetchNpmDeps }:

let
  mkOpenClawNpmRuntimeClosure = import ../lib/mk-openclaw-npm-runtime-closure.nix {
    inherit lib buildNpmPackage fetchNpmDeps;
  };
in
mkOpenClawNpmRuntimeClosure {
  pname = "openclaw-browser-runtime";
  serviceName = "openclaw-browser-runtime";
  servicePath = ../../services/openclaw-browser-runtime;
  npmDepsHash = "sha256-Dti/YTKda1Ol1M4EvbXPyx63Nbj+GjPwOTGp7tYwuBQ=";
  removeModules = [ "@openclaw" "typescript" ];
  files = [
    ../../services/openclaw-browser-runtime/package.json
    ../../services/openclaw-browser-runtime/package-lock.json
    ../../services/openclaw-browser-runtime/src/browser-engine-adapter.mjs
    ../../services/openclaw-browser-runtime/src/browser-graphical-session-binding.mjs
    ../../services/openclaw-browser-runtime/src/browser-navigation.mjs
    ../../services/openclaw-browser-runtime/src/browser-runtime-auth.mjs
    ../../services/openclaw-browser-runtime/src/browser-workspace-store.mjs
    ../../services/openclaw-browser-runtime/src/server.mjs
    ../../packages/shared-events/src/event-factory.mjs
    ../../packages/shared-events/src/event-names.mjs
    ../../packages/shared-utils/package.json
    ../../packages/shared-utils/src/http.mjs
    ../../packages/shared-utils/src/service-credentials.mjs
    ../../packages/shared-utils/src/work-view-input-evidence.mjs
    ../../packages/shared-utils/src/work-view-semantic-targets.mjs
    ../../packages/shared-utils/src/work-view-trust.mjs
    ../../packages/shared-utils/src/work-view-visual-frame.mjs
  ];
}
