import assert from "node:assert/strict";
import test from "node:test";

import { parseBrowserCaptureQuery } from "../src/browser-capture-query.mjs";

function requestUrl(query = "") {
  return new URL(`http://127.0.0.1/browser/capture${query}`);
}

test("browser capture query preserves existing visual defaults", () => {
  assert.deepEqual(parseBrowserCaptureQuery(requestUrl()), {
    ok: true,
    visualMode: "full",
    semanticMode: "items",
    includeSemanticItems: true,
  });
  assert.deepEqual(parseBrowserCaptureQuery(requestUrl("?visual=metadata")), {
    ok: true,
    visualMode: "metadata",
    semanticMode: "summary",
    includeSemanticItems: false,
  });
});

test("browser capture query permits semantic items without visual pixels", () => {
  assert.deepEqual(parseBrowserCaptureQuery(requestUrl("?visual=metadata&semantic=items")), {
    ok: true,
    visualMode: "metadata",
    semanticMode: "items",
    includeSemanticItems: true,
  });
});

test("browser capture query rejects widened visual or semantic modes", () => {
  assert.deepEqual(parseBrowserCaptureQuery(requestUrl("?visual=raw")), {
    ok: false,
    error: "Browser capture visual mode must be full or metadata.",
  });
  assert.deepEqual(parseBrowserCaptureQuery(requestUrl("?semantic=script")), {
    ok: false,
    error: "Browser capture semantic mode must be items or summary.",
  });
});
