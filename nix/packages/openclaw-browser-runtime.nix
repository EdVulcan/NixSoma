{ lib, buildNpmPackage }:

let
  root = ../..;
  workspaceManifests = [
    ../../apps/observer-ui/package.json
    ../../packages/plugin-runtime/package.json
    ../../packages/shared-client/package.json
    ../../packages/shared-events/package.json
    ../../packages/shared-types/package.json
    ../../packages/shared-utils/package.json
    ../../services/openclaw-browser-runtime/package.json
    ../../services/openclaw-core/package.json
    ../../services/openclaw-event-hub/package.json
    ../../services/openclaw-screen-act/package.json
    ../../services/openclaw-screen-sense/package.json
    ../../services/openclaw-session-manager/package.json
    ../../services/openclaw-system-heal/package.json
    ../../services/openclaw-system-sense/package.json
  ];
  runtimeFiles = [
    ../../services/openclaw-browser-runtime/package.json
    ../../services/openclaw-browser-runtime/src/browser-engine-adapter.mjs
    ../../services/openclaw-browser-runtime/src/browser-navigation.mjs
    ../../services/openclaw-browser-runtime/src/browser-workspace-store.mjs
    ../../services/openclaw-browser-runtime/src/server.mjs
    ../../packages/shared-events/src/event-factory.mjs
    ../../packages/shared-events/src/event-names.mjs
    ../../packages/shared-utils/package.json
    ../../packages/shared-utils/src/http.mjs
    ../../packages/shared-utils/src/work-view-input-evidence.mjs
    ../../packages/shared-utils/src/work-view-semantic-targets.mjs
    ../../packages/shared-utils/src/work-view-trust.mjs
    ../../packages/shared-utils/src/work-view-visual-frame.mjs
  ];
in
buildNpmPackage {
  pname = "openclaw-browser-runtime";
  version = "0.1.0";

  src = lib.fileset.toSource {
    inherit root;
    fileset = lib.fileset.unions (
      [ ../../package.json ../../package-lock.json ]
      ++ workspaceManifests
      ++ runtimeFiles
    );
  };

  npmDepsHash = "sha256-vTOCPyAQGg14rHl+sNsq8SgW34vVBXMGWZoXuGrKwNU=";
  npmDepsFetcherVersion = 2;
  npmWorkspace = "services/openclaw-browser-runtime";
  npmInstallFlags = [ "--ignore-scripts" ];
  dontNpmBuild = true;
  PUPPETEER_SKIP_DOWNLOAD = "true";

  installPhase = ''
    runHook preInstall
    npm prune --omit=dev --no-save --ignore-scripts --workspace=services/openclaw-browser-runtime

    runtimeRoot="$out/share/openclaw/services/openclaw-browser-runtime"
    mkdir -p "$runtimeRoot/src" "$runtimeRoot/node_modules"
    cp services/openclaw-browser-runtime/package.json "$runtimeRoot/package.json"
    cp services/openclaw-browser-runtime/src/*.mjs "$runtimeRoot/src/"

    mkdir -p "$out/share/openclaw/packages/shared-events/src"
    cp packages/shared-events/src/event-factory.mjs packages/shared-events/src/event-names.mjs \
      "$out/share/openclaw/packages/shared-events/src/"
    mkdir -p "$out/share/openclaw/packages/shared-utils/src"
    cp packages/shared-utils/package.json "$out/share/openclaw/packages/shared-utils/package.json"
    cp \
      packages/shared-utils/src/http.mjs \
      packages/shared-utils/src/work-view-input-evidence.mjs \
      packages/shared-utils/src/work-view-semantic-targets.mjs \
      packages/shared-utils/src/work-view-trust.mjs \
      packages/shared-utils/src/work-view-visual-frame.mjs \
      "$out/share/openclaw/packages/shared-utils/src/"

    cp -R node_modules/. "$runtimeRoot/node_modules/"
    rm -rf "$runtimeRoot/node_modules/@openclaw" "$runtimeRoot/node_modules/typescript"
    rm -f "$runtimeRoot/node_modules/.bin/tsc" "$runtimeRoot/node_modules/.bin/tsserver"
    runHook postInstall
  '';
}
