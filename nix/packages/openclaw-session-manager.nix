{ lib, stdenvNoCC }:

let
  mkOpenClawSourceClosure = import ../lib/mk-openclaw-source-closure.nix {
    inherit lib stdenvNoCC;
  };
in
mkOpenClawSourceClosure {
  pname = "openclaw-session-manager";
  files = [
    ../../services/openclaw-session-manager/package.json
    ../../services/openclaw-session-manager/src/server.mjs
    ../../services/openclaw-session-manager/src/ai-graphical-session-observer.mjs
    ../../services/openclaw-session-manager/src/trusted-work-view-helper-runtime.mjs
    ../../services/openclaw-session-manager/src/trusted-work-view-sidecar-channel.mjs
    ../../services/openclaw-session-manager/src/trusted-work-view-sidecar-launcher.mjs
    ../../services/openclaw-session-manager/src/trusted-work-view-sidecar-recovery-store.mjs
    ../../services/openclaw-session-manager/src/trusted-work-view-sidecar-supervisor.mjs
    ../../services/openclaw-session-manager/src/trusted-work-view-sidecar.mjs
    ../../packages/shared-events/src/event-factory.mjs
    ../../packages/shared-events/src/event-names.mjs
    ../../packages/shared-utils/package.json
    ../../packages/shared-utils/src/http.mjs
    ../../packages/shared-utils/src/service-credentials.mjs
    ../../packages/shared-utils/src/work-view-trust.mjs
    ../../packages/shared-utils/src/work-view-visual-frame.mjs
  ];
}
