import { existsSync, readFileSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  EXECUTION_GRANT_HEADER,
  executionGrantContextHeaders,
  normaliseExecutionGrantContext,
} from "../../../packages/shared-utils/src/execution-grants.mjs";

export function createServiceClient(urls, {
  executionGrantSigner = null,
  executionGrantTargets = null,
} = {}) {
  const { eventHubUrl, sessionManagerUrl, browserRuntimeUrl,
          screenSenseUrl, screenActUrl, systemSenseUrl, systemHealUrl } = urls;
  const grantContextStorage = new AsyncLocalStorage();
  const grantTargets = executionGrantTargets ?? [
    { audience: "openclaw-screen-act", url: screenActUrl },
    { audience: "openclaw-system-sense", url: systemSenseUrl },
  ];

  function resolveExecutionGrantTarget(url) {
    if (!executionGrantSigner || typeof url !== "string") return null;
    let requestOrigin;
    try {
      requestOrigin = new URL(url).origin;
    } catch {
      return null;
    }
    return grantTargets.find((target) => {
      try {
        return target?.audience && new URL(target.url).origin === requestOrigin;
      } catch {
        return false;
      }
    }) ?? null;
  }

  // L302-330
async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error ?? `Request failed: ${url}`);
  }
  return data;
}

async function postJson(url, body = {}, options = {}) {
  const {
    grantContext = grantContextStorage.getStore() ?? {},
    executionGrant = true,
    ...fetchOptions
  } = options;
  const target = executionGrant ? resolveExecutionGrantTarget(url) : null;
  const headers = {
    "content-type": "application/json",
    ...(fetchOptions.headers ?? {}),
  };
  if (target) {
    const context = normaliseExecutionGrantContext(grantContext);
    const parsedUrl = new URL(url);
    headers[EXECUTION_GRANT_HEADER] = executionGrantSigner.issue({
      audience: target.audience,
      method: "POST",
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      body,
      context,
    });
    Object.assign(headers, executionGrantContextHeaders(context));
  }
  return fetchJson(url, {
    ...fetchOptions,
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function readJsonFileIfPresent(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}


  // L18465-18473
function buildSystemSenseUrl(pathname, params = {}) {
  const url = new URL(pathname, systemSenseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

  return {
    eventHubUrl,
    sessionManagerUrl,
    browserRuntimeUrl,
    screenSenseUrl,
    screenActUrl,
    systemSenseUrl,
    systemHealUrl,
    fetchJson,
    postJson,
    readJsonFileIfPresent,
    buildSystemSenseUrl,
    postJsonWithExecutionGrantContext(context, operation) {
      return grantContextStorage.run(normaliseExecutionGrantContext(context), operation);
    },
  };
}
