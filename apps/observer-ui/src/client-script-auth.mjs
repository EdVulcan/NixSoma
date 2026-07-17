export const observerClientAuthScript = `let operatorSession = null;

function operatorRequestOptions(options = {}) {
  const { skipOperatorAuth = false, ...fetchOptions } = options ?? {};
  const headers = new Headers(fetchOptions.headers ?? {});
  if (!skipOperatorAuth && typeof operatorSession?.token === "string" && operatorSession.token) {
    headers.set("authorization", \`Bearer \${operatorSession.token}\`);
  }
  return {
    ...fetchOptions,
    credentials: "include",
    headers,
  };
}

function renderOperatorAuthState() {
  const authenticated = Boolean(operatorSession?.authenticated);
  operatorAuthStatus.textContent = authenticated ? "authenticated" : "signed out";
  operatorAuthActor.textContent = operatorSession?.operator?.actor ?? "-";
  operatorAuthSignInButton.disabled = authenticated;
  operatorAuthSignOutButton.disabled = !authenticated;
}

async function refreshOperatorSession() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/auth/session\`, { skipOperatorAuth: true });
    operatorSession = { authenticated: true, operator: data.operator };
  } catch {
    operatorSession = null;
  }
  renderOperatorAuthState();
}

async function signInOperator() {
  const token = operatorAuthTokenInput.value.trim();
  if (!token) throw new Error("Operator token is required.");
  operatorAuthSignInButton.disabled = true;
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/auth/login\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      skipOperatorAuth: true,
    });
    operatorSession = { authenticated: true, operator: data.operator };
    operatorAuthTokenInput.value = "";
    renderOperatorAuthState();
    setControlMessage(\`Operator session active for \${data.operator?.actor ?? "operator"}.\`);
  } finally {
    operatorAuthSignInButton.disabled = false;
  }
}

async function signOutOperator() {
  operatorAuthSignOutButton.disabled = true;
  try {
    await fetchJson(\`\${observerConfig.coreUrl}/auth/logout\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      skipOperatorAuth: true,
    });
  } finally {
    operatorSession = null;
    renderOperatorAuthState();
  }
}

operatorAuthSignInButton.addEventListener("click", () => {
  signInOperator().catch((error) => {
    operatorAuthStatus.textContent = error?.message ?? "login failed";
    renderOperatorAuthState();
  });
});
operatorAuthSignOutButton.addEventListener("click", () => {
  signOutOperator().catch((error) => {
    operatorAuthStatus.textContent = error?.message ?? "logout failed";
    renderOperatorAuthState();
  });
});
renderOperatorAuthState();
`;
