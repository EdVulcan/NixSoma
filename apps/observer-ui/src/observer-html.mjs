import { observerStyles } from "./observer-styles.mjs";
import { observerFoundationPanels } from "./observer-panels-foundation.mjs";
import { observerCloudPanels } from "./observer-panels-cloud.mjs";
import { observerOperationsPanels } from "./observer-panels-operations.mjs";
import { observerSystemPanels } from "./observer-panels-system.mjs";

export function observerHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenClaw Observer UI</title>
    <style>
${observerStyles()}    </style>
  </head>
  <body>
    <main>
      <h1>OpenClaw Observer UI</h1>
      <p class="subtitle">Observe the first control-plane loop: runtime, screen, action, system, and heal state.</p>
      <div class="grid">
${observerFoundationPanels()}${observerCloudPanels()}${observerOperationsPanels()}${observerSystemPanels()}      </div>
    </main>
    <script type="module" src="/client-v5.js"></script>
  </body>
</html>`;
}
