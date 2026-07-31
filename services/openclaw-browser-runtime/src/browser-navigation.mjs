import { lookup as defaultLookup } from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";

const MAX_URL_CHARS = 2_048;
const MAX_DOH_RESPONSE_BYTES = 64 * 1024;
const DNS_REQUEST_TIMEOUT_MS = 8_000;

const LOCAL_FIXTURE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const BLOCKED_HOSTNAMES = new Set([
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "instance-data.ec2.internal",
]);

const LOOPBACK_PROXY_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normaliseHostname(value) {
  return String(value ?? "").trim().toLowerCase().replace(/^\[|\]$/gu, "").replace(/\.$/u, "");
}

function isLoopbackProxyHost(value) {
  return LOOPBACK_PROXY_HOSTS.has(normaliseHostname(value));
}

function isLocalFixtureHost(hostname) {
  const normalised = normaliseHostname(hostname);
  return LOCAL_FIXTURE_HOSTS.has(normalised) || normalised.endsWith(".localhost");
}

function isAllowedLocalFixtureUrl(url, localFixtureUrls = []) {
  if (!isLocalFixtureHost(url.hostname) || !Array.isArray(localFixtureUrls)) return false;
  return localFixtureUrls.some((candidate) => {
    try {
      const allowed = new URL(candidate);
      return ["http:", "https:"].includes(allowed.protocol)
        && !allowed.username
        && !allowed.password
        && isLocalFixtureHost(allowed.hostname)
        && allowed.href === url.href;
    } catch {
      return false;
    }
  });
}

function ipv4ToOctets(address) {
  const octets = address.split(".").map((part) => Number.parseInt(part, 10));
  return octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? octets
    : null;
}

function isBlockedIpv4(address) {
  const octets = ipv4ToOctets(address);
  if (!octets) return false;
  const [first, second] = octets;
  return first === 0
    || first === 10
    || first === 100 && second >= 64 && second <= 127
    || first === 127
    || first === 169 && second === 254
    || first === 172 && second >= 16 && second <= 31
    || first === 192 && second === 0
    || first === 192 && second === 168
    || first === 198 && (second === 18 || second === 19)
    || first === 198 && second === 51
    || first === 203 && second === 0
    || first >= 224;
}

function ipv6ToBigInt(address) {
  const normalised = normaliseHostname(address).split("%", 1)[0];
  const halves = normalised.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const expand = (parts) => parts.flatMap((part) => part.includes(".")
    ? (() => {
      const octets = ipv4ToOctets(part);
      return octets ? [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]] : [];
    })()
    : [Number.parseInt(part || "0", 16)]);
  const groups = [...expand(left), ...Array(8 - expand(left).length - expand(right).length).fill(0), ...expand(right)];
  if (groups.length !== 8 || groups.some((group) => !Number.isInteger(group) || group < 0 || group > 0xffff)) return null;
  return groups.reduce((value, group) => (value << 16n) | BigInt(group), 0n);
}

function isBlockedIp(address) {
  const kind = net.isIP(address);
  if (kind === 4) return isBlockedIpv4(address);
  if (kind !== 6) return false;
  const normalised = normaliseHostname(address);
  if (normalised === "::1" || normalised === "::") return true;
  if (normalised.startsWith("::ffff:")) {
    const mapped = normalised.slice("::ffff:".length);
    if (net.isIP(mapped) === 4) return isBlockedIpv4(mapped);
  }
  const value = ipv6ToBigInt(normalised);
  if (value === null) return true;
  const prefix = (bits) => value >> BigInt(128 - bits);
  return prefix(7) === 0x7en
    || prefix(10) === 0x3fan
    || prefix(8) === 0xffn
    || prefix(32) === 0x20010db8n;
}

function assertSafeBrowserHost(url, {
  allowLocalFixtureUrls = false,
  localFixtureUrls = [],
} = {}) {
  const hostname = normaliseHostname(url.hostname);
  if ((allowLocalFixtureUrls && isLocalFixtureHost(hostname))
    || isAllowedLocalFixtureUrl(url, localFixtureUrls)) {
    return;
  }
  if (isLocalFixtureHost(hostname) || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || isBlockedIp(hostname)) {
    const error = new Error("Browser navigation refuses loopback, private, link-local, or metadata addresses.");
    error.code = "BROWSER_URL_PRIVATE_NETWORK_BLOCKED";
    throw error;
  }
}

export function normaliseBoundedBrowserUrl(value, options = {}) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > MAX_URL_CHARS) {
    throw new Error("Browser navigation requires a URL within 2048 characters.");
  }
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Browser navigation requires a valid URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Browser navigation only allows HTTP(S) URLs.");
  }
  if (url.username || url.password) {
    throw new Error("Browser navigation URL must not contain credentials.");
  }
  assertSafeBrowserHost(url, options);
  return url.href;
}

export function normaliseBoundedBrowserHttpProxy(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Browser HTTP proxy requires a valid URL.");
  }
  if (url.protocol !== "http:") {
    throw new Error("Browser HTTP proxy must use HTTP CONNECT.");
  }
  if (url.username || url.password) {
    throw new Error("Browser HTTP proxy URL must not contain credentials.");
  }
  if (!isLoopbackProxyHost(url.hostname)) {
    throw new Error("Browser HTTP proxy must bind to loopback.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Browser HTTP proxy URL must not contain a path or query.");
  }
  return url.href;
}

export function normaliseBoundedBrowserDohUrl(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Browser DNS-over-HTTPS endpoint requires a valid URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Browser DNS-over-HTTPS endpoint must use HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Browser DNS-over-HTTPS endpoint must not contain credentials or query state.");
  }
  assertSafeBrowserHost(url);
  return url.href;
}

function parseProxy(value) {
  const url = new URL(normaliseBoundedBrowserHttpProxy(value));
  return {
    hostname: normaliseHostname(url.hostname),
    port: Number.parseInt(url.port || "80", 10),
  };
}

function waitForConnect(socket) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      socket.off("connect", onConnect);
      reject(error);
    };
    const onConnect = () => {
      socket.off("error", onError);
      resolve();
    };
    socket.once("error", onError);
    socket.once("connect", onConnect);
  });
}

function readHeaders(socket) {
  return new Promise((resolve, reject) => {
    let data = Buffer.alloc(0);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Browser DNS-over-HTTPS proxy response timed out."));
    }, DNS_REQUEST_TIMEOUT_MS);
    const onData = (chunk) => {
      data = Buffer.concat([data, chunk]);
      if (data.length > MAX_DOH_RESPONSE_BYTES) {
        clearTimeout(timer);
        socket.off("data", onData);
        socket.destroy();
        reject(new Error("Browser DNS-over-HTTPS proxy response is too large."));
        return;
      }
      const marker = data.indexOf(Buffer.from("\r\n\r\n"));
      if (marker === -1) return;
      clearTimeout(timer);
      socket.off("data", onData);
      resolve({
        header: data.subarray(0, marker + 4),
        remainder: data.subarray(marker + 4),
      });
    };
    socket.on("data", onData);
    socket.once("error", (error) => {
      clearTimeout(timer);
      socket.off("data", onData);
      reject(error);
    });
  });
}

function decodeChunkedBody(buffer) {
  const chunks = [];
  let offset = 0;
  while (true) {
    const lineEnd = buffer.indexOf(Buffer.from("\r\n"), offset);
    if (lineEnd === -1) throw new Error("Browser DNS-over-HTTPS chunked response is incomplete.");
    const sizeText = buffer.subarray(offset, lineEnd).toString("ascii").split(";", 1)[0].trim();
    const size = Number.parseInt(sizeText, 16);
    if (!Number.isInteger(size) || size < 0) throw new Error("Browser DNS-over-HTTPS chunk size is invalid.");
    offset = lineEnd + 2;
    if (size === 0) return Buffer.concat(chunks);
    if (offset + size + 2 > buffer.length) {
      throw new Error("Browser DNS-over-HTTPS chunked response is incomplete.");
    }
    chunks.push(buffer.subarray(offset, offset + size));
    offset += size;
    if (buffer.subarray(offset, offset + 2).toString("ascii") !== "\r\n") {
      throw new Error("Browser DNS-over-HTTPS chunk terminator is invalid.");
    }
    offset += 2;
  }
}

function parseHttpResponse(buffer) {
  const marker = buffer.indexOf(Buffer.from("\r\n\r\n"));
  if (marker === -1) throw new Error("Browser DNS-over-HTTPS response headers are incomplete.");
  const headerText = buffer.subarray(0, marker).toString("latin1");
  const lines = headerText.split("\r\n");
  const statusMatch = /^HTTP\/\d(?:\.\d)?\s+(\d{3})\b/u.exec(lines.shift() ?? "");
  if (!statusMatch) throw new Error("Browser DNS-over-HTTPS response status is invalid.");
  const headers = new Map();
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }
  let body = buffer.subarray(marker + 4);
  if (headers.get("transfer-encoding")?.toLowerCase().includes("chunked")) {
    body = decodeChunkedBody(body);
  } else {
    const contentLength = Number.parseInt(headers.get("content-length") ?? "", 10);
    if (Number.isInteger(contentLength)) {
      if (body.length < contentLength) throw new Error("Browser DNS-over-HTTPS response body is incomplete.");
      body = body.subarray(0, contentLength);
    }
  }
  return { statusCode: Number.parseInt(statusMatch[1], 10), headers, body };
}

async function requestDohThroughProxy({ resolverUrl, proxyUrl, hostname, recordType }) {
  const target = new URL(resolverUrl);
  target.searchParams.set("name", hostname);
  target.searchParams.set("type", recordType);
  const proxy = parseProxy(proxyUrl);
  let socket = null;
  try {
    socket = net.connect(proxy.port, proxy.hostname);
    await waitForConnect(socket);
    socket.write(`CONNECT ${target.hostname}:443 HTTP/1.1\r\nHost: ${target.hostname}:443\r\nConnection: keep-alive\r\n\r\n`);
    const proxyResponse = await readHeaders(socket);
    const proxyStatus = /^HTTP\/\d(?:\.\d)?\s+(\d{3})\b/u.exec(proxyResponse.header.toString("latin1"));
    if (!proxyStatus || Number.parseInt(proxyStatus[1], 10) !== 200 || proxyResponse.remainder.length > 0) {
      throw new Error("Browser DNS-over-HTTPS proxy CONNECT was rejected.");
    }
    const secureSocket = tls.connect({ socket, servername: target.hostname });
    socket = secureSocket;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        secureSocket.destroy();
        reject(new Error("Browser DNS-over-HTTPS TLS handshake timed out."));
      }, DNS_REQUEST_TIMEOUT_MS);
      secureSocket.once("secureConnect", () => {
        clearTimeout(timer);
        resolve();
      });
      secureSocket.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    const requestPath = `${target.pathname || "/"}${target.search}`;
    secureSocket.write(`GET ${requestPath} HTTP/1.1\r\nHost: ${target.host}\r\nAccept: application/dns-json\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`);
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of secureSocket) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_DOH_RESPONSE_BYTES) throw new Error("Browser DNS-over-HTTPS response is too large.");
      chunks.push(chunk);
    }
    const response = parseHttpResponse(Buffer.concat(chunks));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Browser DNS-over-HTTPS endpoint returned HTTP ${response.statusCode}.`);
    }
    return JSON.parse(response.body.toString("utf8"));
  } finally {
    socket?.destroy();
  }
}

function projectDohAddresses(payload, recordType) {
  const expectedFamily = recordType === "A" ? 4 : 6;
  return (Array.isArray(payload?.Answer) ? payload.Answer : [])
    .filter((answer) => answer?.type === (expectedFamily === 4 ? 1 : 28))
    .map((answer) => normaliseHostname(answer.data))
    .filter((address) => net.isIP(address) === expectedFamily)
    .map((address) => ({ address, family: expectedFamily }));
}

async function lookupViaDoh(hostname, { resolverUrl, proxyUrl, request = requestDohThroughProxy } = {}) {
  const normalised = normaliseHostname(hostname);
  const literalFamily = net.isIP(normalised);
  if (literalFamily) return [{ address: normalised, family: literalFamily }];
  const records = await Promise.all(["A", "AAAA"].map(async (recordType) => projectDohAddresses(
    await request({ resolverUrl, proxyUrl, hostname: normalised, recordType }),
    recordType,
  )));
  return records.flat();
}

export function createBoundedBrowserHostnameLookup({ dohUrl = null, httpProxy = null, directLookup = defaultLookup, dohRequest } = {}) {
  const resolverUrl = normaliseBoundedBrowserDohUrl(dohUrl);
  const proxyUrl = normaliseBoundedBrowserHttpProxy(httpProxy);
  if (!resolverUrl && !proxyUrl) return directLookup;
  if (!resolverUrl || !proxyUrl) {
    throw new Error("Browser DNS-over-HTTPS requires both a resolver URL and a loopback HTTP proxy.");
  }
  return (hostname) => lookupViaDoh(hostname, {
    resolverUrl,
    proxyUrl,
    ...(dohRequest ? { request: dohRequest } : {}),
  });
}

export async function validateBoundedBrowserUrl(value, {
  allowLocalFixtureUrls = false,
  localFixtureUrls = [],
  lookup = defaultLookup,
} = {}) {
  const href = normaliseBoundedBrowserUrl(value, { allowLocalFixtureUrls, localFixtureUrls });
  const url = new URL(href);
  if ((allowLocalFixtureUrls && isLocalFixtureHost(url.hostname))
    || isAllowedLocalFixtureUrl(url, localFixtureUrls)) {
    return href;
  }

  let addresses;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch (error) {
    const wrapped = new Error("Browser navigation DNS validation failed.");
    wrapped.code = "BROWSER_URL_DNS_VALIDATION_FAILED";
    wrapped.cause = error;
    throw wrapped;
  }
  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some((entry) => isBlockedIp(entry.address))) {
    const error = new Error("Browser navigation DNS result resolves to a private or unavailable address.");
    error.code = "BROWSER_URL_DNS_PRIVATE_NETWORK_BLOCKED";
    throw error;
  }
  return href;
}

export function isHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
