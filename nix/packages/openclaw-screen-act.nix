{ lib, stdenvNoCC }:

let
  mkOpenClawSourceClosure = import ../lib/mk-openclaw-source-closure.nix {
    inherit lib stdenvNoCC;
  };
in
mkOpenClawSourceClosure {
  pname = "openclaw-screen-act";
  files = [
    ../../services/openclaw-screen-act/package.json
    ../../services/openclaw-screen-act/src/server.mjs
    ../../services/openclaw-screen-act/src/trusted-work-view-action-mediation.mjs
    ../../packages/shared-events/src/event-factory.mjs
    ../../packages/shared-events/src/event-names.mjs
    ../../packages/shared-utils/package.json
    ../../packages/shared-utils/src/http.mjs
    ../../packages/shared-utils/src/work-view-trust.mjs
    ../../packages/shared-utils/src/work-view-visual-frame.mjs
    ../../packages/shared-utils/src/work-view-semantic-targets.mjs
    ../../packages/shared-utils/src/work-view-input-evidence.mjs
  ];
}
