import assert from "node:assert/strict";
import test from "node:test";

import { observerClientAuthScript } from "../src/client-script-auth.mjs";
import { observerClientConfigDomOperatorAuthScript } from "../src/client-script-config-dom-operator-auth.mjs";
import { observerOperatorAuthPanel } from "../src/observer-panels-operator-auth.mjs";

test("Observer exposes a credential-free operator session panel", () => {
  const panel = observerOperatorAuthPanel();
  for (const token of [
    "operator-auth-panel",
    "operator-auth-token",
    "operator-auth-sign-in",
    "operator-auth-sign-out",
  ]) {
    assert.equal(panel.includes(token), true, `panel is missing ${token}`);
  }
  assert.match(observerClientConfigDomOperatorAuthScript, /operatorAuthTokenInput/u);
  assert.match(observerClientAuthScript, /credentials: "include"/u);
  assert.match(observerClientAuthScript, /auth\/login/u);
  assert.match(observerClientAuthScript, /auth\/logout/u);
  assert.doesNotMatch(observerClientAuthScript, /localStorage/u);
});
