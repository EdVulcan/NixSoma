import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createServiceCredentialHeaders,
  credentialsMatch,
  readServiceCredential,
  readServiceCredentialMap,
} from "../src/service-credentials.mjs";

test("service credentials read bounded values and maps from files", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "openclaw-service-credentials-"));
  try {
    const tokenPath = path.join(directory, "token");
    const mapPath = path.join(directory, "map.json");
    writeFileSync(tokenPath, "  token-from-file  \n", "utf8");
    writeFileSync(mapPath, JSON.stringify({ "openclaw-core": "core-token" }), "utf8");

    assert.equal(readServiceCredential({ filePath: tokenPath }), "token-from-file");
    assert.deepEqual(readServiceCredentialMap({ filePath: mapPath }), {
      "openclaw-core": "core-token",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("service credentials use constant-time equality and caller-bound headers", () => {
  assert.equal(credentialsMatch("same-token", "same-token"), true);
  assert.equal(credentialsMatch("wrong-token", "same-token"), false);
  assert.deepEqual(createServiceCredentialHeaders({
    token: "service-token",
    caller: "openclaw-core",
    extraHeaders: { "content-type": "application/json" },
  }), {
    "content-type": "application/json",
    "x-openclaw-service-caller": "openclaw-core",
    authorization: "Bearer service-token",
  });
});
