import test from "node:test";
import assert from "node:assert/strict";

import {
  createBoundedBrowserHostnameLookup,
  normaliseBoundedBrowserDohUrl,
  normaliseBoundedBrowserHttpProxy,
  normaliseBoundedBrowserUrl,
  validateBoundedBrowserUrl,
} from "../src/browser-navigation.mjs";

test("bounded browser navigation accepts canonical HTTP(S) URLs", () => {
  assert.equal(normaliseBoundedBrowserUrl("https://example.com/docs"), "https://example.com/docs");
  assert.equal(normaliseBoundedBrowserUrl("http://example.com"), "http://example.com/");
});

test("bounded browser navigation rejects credentials, non-network schemes, and oversized URLs", () => {
  assert.throws(() => normaliseBoundedBrowserUrl("https://user:secret@example.com"), /must not contain credentials/u);
  assert.throws(() => normaliseBoundedBrowserUrl("file:///tmp/secret"), /only allows HTTP\(S\)/u);
  assert.throws(() => normaliseBoundedBrowserUrl(`https://example.com/${"a".repeat(2_048)}`), /within 2048/u);
  assert.throws(() => normaliseBoundedBrowserUrl("http://127.0.0.1/internal"), /private/u);
  assert.equal(
    normaliseBoundedBrowserUrl("http://127.0.0.1/fixture", { allowLocalFixtureUrls: true }),
    "http://127.0.0.1/fixture",
  );
});

test("bounded browser navigation allows only an exact fixed loopback fixture URL", async () => {
  const fixture = "http://127.0.0.1:4103/fixtures/semantic-submit";
  const options = { localFixtureUrls: [fixture] };
  assert.equal(normaliseBoundedBrowserUrl(fixture, options), fixture);
  assert.equal(await validateBoundedBrowserUrl(fixture, options), fixture);
  for (const rejected of [
    "http://127.0.0.1:4103/fixtures/semantic-submit?value=secret",
    "http://127.0.0.1:4103/fixtures/semantic-submit/complete",
    "http://127.0.0.1:4104/fixtures/semantic-submit",
    "http://127.0.0.1:4103/internal",
  ]) {
    assert.throws(() => normaliseBoundedBrowserUrl(rejected, options), /private/u);
  }
});

test("browser network configuration is explicit and loopback-only", async () => {
  assert.equal(normaliseBoundedBrowserHttpProxy("http://127.0.0.1:7897"), "http://127.0.0.1:7897/");
  assert.equal(normaliseBoundedBrowserDohUrl("https://doh.pub/dns-query"), "https://doh.pub/dns-query");
  assert.throws(() => normaliseBoundedBrowserHttpProxy("http://proxy.example:7897"), /loopback/u);
  assert.throws(() => normaliseBoundedBrowserHttpProxy("http://user:secret@127.0.0.1:7897"), /credentials/u);
  assert.throws(() => createBoundedBrowserHostnameLookup({ httpProxy: "http://127.0.0.1:7897" }), /both/u);
  const lookup = createBoundedBrowserHostnameLookup({
    dohUrl: "https://doh.pub/dns-query",
    httpProxy: "http://127.0.0.1:7897",
    dohRequest: async ({ recordType }) => ({
      Answer: recordType === "A" ? [{ type: 1, data: "93.184.216.34" }] : [],
    }),
  });
  assert.deepEqual(await lookup("public.example", { all: true }), [{ address: "93.184.216.34", family: 4 }]);
});

test("browser navigation rejects DNS results that point at private networks, including redirects", async () => {
  await assert.rejects(
    () => validateBoundedBrowserUrl("https://redirect.example", {
      lookup: async () => [{ address: "127.0.0.1", family: 4 }],
    }),
    (error) => error?.code === "BROWSER_URL_DNS_PRIVATE_NETWORK_BLOCKED",
  );
  await assert.rejects(
    () => validateBoundedBrowserUrl("https://metadata.example", {
      lookup: async () => [{ address: "169.254.169.254", family: 4 }],
    }),
    (error) => error?.code === "BROWSER_URL_DNS_PRIVATE_NETWORK_BLOCKED",
  );
  assert.equal(
    await validateBoundedBrowserUrl("https://public.example", {
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    }),
    "https://public.example/",
  );
});
