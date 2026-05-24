import { readFileSync } from "node:fs";

export function createServiceClient(urls) {
  const { eventHubUrl, sessionManagerUrl, browserRuntimeUrl,
          screenSenseUrl, screenActUrl, systemSenseUrl, systemHealUrl } = urls;

  // L302-330
async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error ?? `Request failed: ${url}`);
  }
  return data;
}

async function postJson(url, body = {}) {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
    fetchJson, postJson, readJsonFileIfPresent, buildSystemSenseUrl
  };
}
