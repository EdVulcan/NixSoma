import fs from "node:fs";
import { timingSafeEqual } from "node:crypto";

function normaliseText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readServiceCredential({ value = null, filePath = null, label = "service credential" } = {}) {
  const direct = normaliseText(value);
  if (direct) return direct;

  const path = normaliseText(filePath);
  if (!path) return null;
  try {
    return normaliseText(fs.readFileSync(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable to read credential file";
    throw new Error(`Unable to read OpenClaw ${label}: ${message}`);
  }
}

function parseCredentialMap(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`OpenClaw ${label} must contain an object map.`);
  }
  const entries = Object.entries(value)
    .map(([key, token]) => [normaliseText(key), normaliseText(token)])
    .filter(([key, token]) => key && token);
  if (entries.length === 0) {
    throw new Error(`OpenClaw ${label} must contain at least one credential.`);
  }
  return Object.freeze(Object.fromEntries(entries));
}

export function readServiceCredentialMap({ value = null, filePath = null, label = "service credential map" } = {}) {
  let source = value && typeof value === "object" ? value : normaliseText(value);
  if (!source) {
    const path = normaliseText(filePath);
    if (!path) return null;
    try {
      source = fs.readFileSync(path, "utf8");
    } catch (error) {
      const message = error instanceof Error ? error.message : "unable to read credential map";
      throw new Error(`Unable to read OpenClaw ${label}: ${message}`);
    }
  }
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      throw new Error(`OpenClaw ${label} is not valid JSON.`);
    }
  }
  return parseCredentialMap(source, label);
}

export function credentialsMatch(supplied, expected) {
  const left = Buffer.from(normaliseText(supplied) ?? "", "utf8");
  const right = Buffer.from(normaliseText(expected) ?? "", "utf8");
  const length = Math.max(left.length, right.length);
  const paddedLeft = Buffer.alloc(length);
  const paddedRight = Buffer.alloc(length);
  left.copy(paddedLeft);
  right.copy(paddedRight);
  return left.length === right.length && timingSafeEqual(paddedLeft, paddedRight);
}

export function createServiceCredentialHeaders({ token, caller, extraHeaders = {} } = {}) {
  const headers = { ...extraHeaders };
  const normalisedCaller = normaliseText(caller);
  const normalisedToken = normaliseText(token);
  if (normalisedCaller) headers["x-openclaw-service-caller"] = normalisedCaller;
  if (normalisedToken) headers.authorization = `Bearer ${normalisedToken}`;
  return headers;
}
