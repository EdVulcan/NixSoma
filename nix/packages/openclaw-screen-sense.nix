{ lib, stdenvNoCC }:

let
  mkOpenClawSourceClosure = import ../lib/mk-openclaw-source-closure.nix {
    inherit lib stdenvNoCC;
  };
in
mkOpenClawSourceClosure {
  pname = "openclaw-screen-sense";
  files = [
    ../../services/openclaw-screen-sense/package.json
    ../../services/openclaw-screen-sense/src/server.mjs
    ../../services/openclaw-screen-sense/src/capture-adapter.mjs
    ../../packages/shared-events/src/event-factory.mjs
    ../../packages/shared-events/src/event-names.mjs
    ../../packages/shared-utils/package.json
    ../../packages/shared-utils/src/http.mjs
    ../../packages/shared-utils/src/service-credentials.mjs
    ../../packages/shared-utils/src/work-view-trust.mjs
    ../../packages/shared-utils/src/work-view-visual-frame.mjs
    ../../packages/shared-utils/src/work-view-semantic-targets.mjs
  ];
}
