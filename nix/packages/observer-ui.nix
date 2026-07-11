{ lib, stdenvNoCC }:

let
  mkOpenClawSourceClosure = import ../lib/mk-openclaw-source-closure.nix {
    inherit lib stdenvNoCC;
  };
in
mkOpenClawSourceClosure {
  pname = "openclaw-observer-ui";
  files = [
    ../../apps/observer-ui/package.json
    ../../apps/observer-ui/src/client-script-config-dom-cloud-provider.mjs
    ../../apps/observer-ui/src/client-script-config-dom-mvp-memory.mjs
    ../../apps/observer-ui/src/client-script-config-dom-system-body.mjs
    ../../apps/observer-ui/src/client-script-config-dom-workspace-source.mjs
    ../../apps/observer-ui/src/client-script-config-dom.mjs
    ../../apps/observer-ui/src/client-script-refreshers-app.mjs
    ../../apps/observer-ui/src/client-script-refreshers-body-evidence.mjs
    ../../apps/observer-ui/src/client-script-refreshers-cloud-context.mjs
    ../../apps/observer-ui/src/client-script-refreshers-cloud-live-launch.mjs
    ../../apps/observer-ui/src/client-script-refreshers-cloud-live-local-read.mjs
    ../../apps/observer-ui/src/client-script-refreshers-cloud-live-result-envelope.mjs
    ../../apps/observer-ui/src/client-script-refreshers-cloud-live-runbook.mjs
    ../../apps/observer-ui/src/client-script-refreshers-cloud.mjs
    ../../apps/observer-ui/src/client-script-refreshers-memory-phases.mjs
    ../../apps/observer-ui/src/client-script-refreshers-mvp-phases.mjs
    ../../apps/observer-ui/src/client-script-refreshers-runtime.mjs
    ../../apps/observer-ui/src/client-script-refreshers-systemd.mjs
    ../../apps/observer-ui/src/client-script-refreshers-workspace-source.mjs
    ../../apps/observer-ui/src/client-script-renderers-acpx-codex-bridge.mjs
    ../../apps/observer-ui/src/client-script-renderers-engineering-edit.mjs
    ../../apps/observer-ui/src/client-script-renderers-engineering-lsp.mjs
    ../../apps/observer-ui/src/client-script-renderers-engineering-microcompact.mjs
    ../../apps/observer-ui/src/client-script-renderers-engineering-plan-todo.mjs
    ../../apps/observer-ui/src/client-script-renderers-engineering-recovery.mjs
    ../../apps/observer-ui/src/client-script-renderers-engineering-verification.mjs
    ../../apps/observer-ui/src/client-script-renderers-engineering-write-execution.mjs
    ../../apps/observer-ui/src/client-script-renderers-engineering-write.mjs
    ../../apps/observer-ui/src/client-script-renderers-native-runtime-refresh.mjs
    ../../apps/observer-ui/src/client-script-renderers-workspace-source.mjs
    ../../apps/observer-ui/src/client-script-renderers.mjs
    ../../apps/observer-ui/src/client-script-runtime-actions.mjs
    ../../apps/observer-ui/src/client-script-runtime-approval-tasks.mjs
    ../../apps/observer-ui/src/client-script-runtime-bindings.mjs
    ../../apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
    ../../apps/observer-ui/src/client-script-runtime-engineering-suggested-action.mjs
    ../../apps/observer-ui/src/client-script-runtime-system-body-tasks.mjs
    ../../apps/observer-ui/src/client-script-startup-refreshes.mjs
    ../../apps/observer-ui/src/client-script-startup.mjs
    ../../apps/observer-ui/src/client-script.mjs
    ../../apps/observer-ui/src/observer-html.mjs
    ../../apps/observer-ui/src/observer-panels-cloud.mjs
    ../../apps/observer-ui/src/observer-panels-foundation.mjs
    ../../apps/observer-ui/src/observer-panels-operations.mjs
    ../../apps/observer-ui/src/observer-panels-system.mjs
    ../../apps/observer-ui/src/observer-styles.mjs
    ../../apps/observer-ui/src/server.mjs
    ../../packages/shared-client/package.json
    ../../packages/shared-client/src/service-descriptors.mjs
  ];
}
