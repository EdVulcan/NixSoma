import { observerClientConfigDomScript } from "./client-script-config-dom.mjs";
import { observerClientAuthScript } from "./client-script-auth.mjs";
import { observerClientRenderersScript } from "./client-script-renderers.mjs";
import { observerClientAppRefreshersScript } from "./client-script-refreshers-app.mjs";
import { observerClientCloudRefreshersScript } from "./client-script-refreshers-cloud.mjs";
import { observerClientRuntimeRefreshersScript } from "./client-script-refreshers-runtime.mjs";
import { observerClientRuntimeActionsScript } from "./client-script-runtime-actions.mjs";
import { observerClientStartupScript } from "./client-script-startup.mjs";

const OBSERVER_CLIENT_SCRIPT_CHUNKS = [
  observerClientConfigDomScript,
  observerClientAuthScript,
  observerClientRenderersScript,
  observerClientAppRefreshersScript,
  observerClientCloudRefreshersScript,
  observerClientRuntimeRefreshersScript,
  observerClientRuntimeActionsScript,
  observerClientStartupScript,
];

export function clientScript() {
  return OBSERVER_CLIENT_SCRIPT_CHUNKS.join("");
}
