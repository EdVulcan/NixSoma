import { observerStyles } from "./observer-styles.mjs";
import { observerFoundationPanels } from "./observer-panels-foundation.mjs";
import { observerCloudPanels } from "./observer-panels-cloud.mjs";
import { observerEngineeringContextPanels } from "./observer-panels-engineering-context.mjs";
import { observerOperationsPanels } from "./observer-panels-operations.mjs";
import { observerSystemPanels } from "./observer-panels-system.mjs";
import { observerDeclarativeEvolutionPanels } from "./observer-panels-declarative-evolution.mjs";
import { observerOperatorAuthPanel } from "./observer-panels-operator-auth.mjs";

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
${observerOperatorAuthPanel()}${observerFoundationPanels()}${observerCloudPanels()}${observerOperationsPanels()}${observerEngineeringContextPanels()}${observerSystemPanels()}${observerDeclarativeEvolutionPanels()}      </div>
    </main>
    <script type="module" src="/client-v5.js"></script>
  </body>
</html>`;
}
