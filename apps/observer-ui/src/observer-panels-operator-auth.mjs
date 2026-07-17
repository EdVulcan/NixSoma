export function observerOperatorAuthPanel() {
  return `        <section class="panel" id="operator-auth-panel">
          <h2>Operator Session</h2>
          <div class="metric"><span>Status</span><span id="operator-auth-status">signed out</span></div>
          <div class="metric"><span>Actor</span><span id="operator-auth-actor">-</span></div>
          <label for="operator-auth-token">Token</label>
          <input id="operator-auth-token" type="password" autocomplete="current-password" />
          <div class="button-row">
            <button id="operator-auth-sign-in" type="button">Sign in</button>
            <button id="operator-auth-sign-out" type="button" disabled>Sign out</button>
          </div>
        </section>
`;
}
