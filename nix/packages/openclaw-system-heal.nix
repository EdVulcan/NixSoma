{ lib, stdenvNoCC }:

let
  mkOpenClawSourceClosure = import ../lib/mk-openclaw-source-closure.nix {
    inherit lib stdenvNoCC;
  };
in
mkOpenClawSourceClosure {
  pname = "openclaw-system-heal";
  files = [
    ../../services/openclaw-system-heal/package.json
    ../../services/openclaw-system-heal/src/server.mjs
    ../../packages/shared-events/src/event-factory.mjs
    ../../packages/shared-events/src/event-names.mjs
    ../../packages/shared-utils/package.json
    ../../packages/shared-utils/src/http.mjs
    ../../packages/shared-utils/src/service-credentials.mjs
    ../../packages/shared-utils/src/persist.mjs
  ];
}
