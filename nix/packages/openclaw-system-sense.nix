{ lib, buildNpmPackage, fetchNpmDeps }:

let
  mkOpenClawNpmRuntimeClosure = import ../lib/mk-openclaw-npm-runtime-closure.nix {
    inherit lib buildNpmPackage fetchNpmDeps;
  };
in
mkOpenClawNpmRuntimeClosure {
  pname = "openclaw-system-sense";
  serviceName = "openclaw-system-sense";
  servicePath = ../../services/openclaw-system-sense;
  npmDepsHash = "sha256-zBGbb/sOqgi2cBeudc7uWd/sfwrAkMg4O2RdtiueqnE=";
  removeModules = [ "@openclaw" "puppeteer-core" "typescript" ];
  files = [
    ../../services/openclaw-system-sense/package.json
    ../../services/openclaw-system-sense/package-lock.json
    ../../services/openclaw-system-sense/src/server.mjs
    ../../services/openclaw-system-sense/src/kernel-process-exec-capture.mjs
    ../../services/openclaw-system-sense/src/kernel-process-exec-readback.mjs
    ../../services/openclaw-system-sense/src/system-body-evidence-routes.mjs
    ../../services/openclaw-system-sense/src/system-body-evidence.mjs
    ../../services/openclaw-system-sense/src/system-command-operations.mjs
    ../../services/openclaw-system-sense/src/system-command-routes.mjs
    ../../services/openclaw-system-sense/src/system-file-operations.mjs
    ../../services/openclaw-system-sense/src/system-file-routes.mjs
    ../../services/openclaw-system-sense/src/system-health-governance.mjs
    ../../services/openclaw-system-sense/src/system-health-routes.mjs
    ../../services/openclaw-system-sense/src/system-kernel-event-routes.mjs
    ../../services/openclaw-system-sense/src/systemd-dbus-adapter.mjs
    ../../services/openclaw-system-sense/src/systemd-dbus-transport.mjs
    ../../services/openclaw-system-sense/src/systemd-inspection.mjs
    ../../services/openclaw-system-sense/src/systemd-next-repair-planning.mjs
    ../../services/openclaw-system-sense/src/systemd-repair-candidate-planning.mjs
    ../../services/openclaw-system-sense/src/systemd-repair-proposals.mjs
    ../../services/openclaw-system-sense/src/systemd-routes.mjs
    ../../packages/shared-systemd/src/systemd-dbus-transport.mjs
    ../../packages/shared-events/src/event-factory.mjs
    ../../packages/shared-events/src/event-names.mjs
    ../../packages/shared-utils/package.json
    ../../packages/shared-utils/src/http.mjs
  ];
}
