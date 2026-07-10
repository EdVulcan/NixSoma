import test from "node:test";
import assert from "node:assert/strict";

import { normaliseBoundedBrowserUrl } from "../src/browser-navigation.mjs";

test("bounded browser navigation accepts canonical HTTP(S) URLs", () => {
  assert.equal(normaliseBoundedBrowserUrl("https://example.com/docs"), "https://example.com/docs");
  assert.equal(normaliseBoundedBrowserUrl("http://example.com"), "http://example.com/");
});

test("bounded browser navigation rejects credentials, non-network schemes, and oversized URLs", () => {
  assert.throws(() => normaliseBoundedBrowserUrl("https://user:secret@example.com"), /must not contain credentials/u);
  assert.throws(() => normaliseBoundedBrowserUrl("file:///tmp/secret"), /only allows HTTP\(S\)/u);
  assert.throws(() => normaliseBoundedBrowserUrl(`https://example.com/${"a".repeat(2_048)}`), /within 2048/u);
});
