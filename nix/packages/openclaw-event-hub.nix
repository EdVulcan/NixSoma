{ lib, stdenvNoCC }:

let
  mkOpenClawSourceClosure = import ../lib/mk-openclaw-source-closure.nix {
    inherit lib stdenvNoCC;
  };
in
mkOpenClawSourceClosure {
  pname = "openclaw-event-hub";
  files = [
    ../../services/openclaw-event-hub/package.json
    ../../services/openclaw-event-hub/src/server.mjs
    ../../services/openclaw-event-hub/src/event-ingress.mjs
    ../../packages/shared-utils/package.json
    ../../packages/shared-utils/src/http.mjs
    ../../packages/shared-utils/src/service-credentials.mjs
  ];
}
