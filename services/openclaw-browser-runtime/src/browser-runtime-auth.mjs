import {
  credentialsMatch,
  readServiceCredential,
  readServiceCredentialMap,
} from "../../../packages/shared-utils/src/service-credentials.mjs";

function boundedCaller(value) {
  const caller = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9._-]{1,120}$/u.test(caller) ? caller : null;
}

function bearerCredential(req) {
  const authorization = typeof req?.headers?.authorization === "string"
    ? req.headers.authorization
    : "";
  const match = /^Bearer\s+([^\s]+)$/iu.exec(authorization.trim());
  return match?.[1] ?? null;
}

function authError(message) {
  const error = new Error(message);
  error.code = "BROWSER_RUNTIME_AUTH_REQUIRED";
  return error;
}

export function createBrowserRuntimeAuthenticator({
  token = null,
  tokenFilePath = process.env.OPENCLAW_BROWSER_RUNTIME_AUTH_TOKEN_FILE,
  tokensByCaller = null,
  credentialMapFilePath = process.env.OPENCLAW_BROWSER_RUNTIME_CREDENTIAL_MAP_FILE,
  required = false,
} = {}) {
  const expectedToken = readServiceCredential({
    filePath: tokenFilePath,
    value: tokenFilePath ? null : token,
    label: "browser-runtime credential",
  });
  const expectedTokensByCaller = readServiceCredentialMap({
    value: tokensByCaller,
    filePath: credentialMapFilePath,
    label: "browser-runtime credential map",
  });

  if (required && !expectedToken && !expectedTokensByCaller) {
    throw new Error("OpenClaw Browser Runtime requires a per-caller credential map.");
  }

  function authenticateRequest(req) {
    const caller = boundedCaller(req?.headers?.["x-openclaw-service-caller"]);
    if (expectedTokensByCaller) {
      if (!caller || !credentialsMatch(bearerCredential(req), expectedTokensByCaller[caller])) {
        throw authError("Browser Runtime requires the credential assigned to its service caller.");
      }
      return {
        ok: true,
        authenticated: true,
        caller,
        identity: caller,
        mode: "per-caller",
      };
    }

    if (!expectedToken && !required) {
      return {
        ok: true,
        authenticated: false,
        caller: caller ?? "browser-runtime-loopback",
        mode: "loopback-compatibility",
      };
    }

    if (!credentialsMatch(bearerCredential(req), expectedToken)) {
      throw authError("Browser Runtime requires authenticated internal service access.");
    }
    return {
      ok: true,
      authenticated: true,
      caller: caller ?? "legacy-shared-token",
      mode: "shared-token-compatibility",
    };
  }

  return { authenticateRequest };
}
