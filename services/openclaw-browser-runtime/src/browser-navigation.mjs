import { lookup as defaultLookup } from "node:dns/promises";
import net from "node:net";

const MAX_URL_CHARS = 2_048;

const LOCAL_FIXTURE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const BLOCKED_HOSTNAMES = new Set([
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "instance-data.ec2.internal",
]);

function normaliseHostname(value) {
  return String(value ?? "").trim().toLowerCase().replace(/^\[|\]$/gu, "").replace(/\.$/u, "");
}

function isLocalFixtureHost(hostname) {
  const normalised = normaliseHostname(hostname);
  return LOCAL_FIXTURE_HOSTS.has(normalised) || normalised.endsWith(".localhost");
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

function assertSafeBrowserHost(url, { allowLocalFixtureUrls = false } = {}) {
  const hostname = normaliseHostname(url.hostname);
  if (allowLocalFixtureUrls && isLocalFixtureHost(hostname)) {
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

export async function validateBoundedBrowserUrl(value, { allowLocalFixtureUrls = false, lookup = defaultLookup } = {}) {
  const href = normaliseBoundedBrowserUrl(value, { allowLocalFixtureUrls });
  const url = new URL(href);
  if (allowLocalFixtureUrls && isLocalFixtureHost(url.hostname)) {
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
