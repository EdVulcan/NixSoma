import test from "node:test";
import assert from "node:assert/strict";

import { createLspSymbolRequestHandshake } from "../src/native-engineering-lsp-protocol-handshake.mjs";

function frame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function stdoutForSymbolResponse({ method, result }) {
  return [
    frame({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } }),
    frame({ jsonrpc: "2.0", id: 3, result }),
    frame({ jsonrpc: "2.0", id: 4, result: null }),
  ].join("");
}

test("LSP symbol request handshake summarises references without raw payload", () => {
  const handshake = createLspSymbolRequestHandshake({
    symbolRequest: {
      method: "textDocument/references",
      params: {
        textDocument: { uri: "file:///workspace/src/app.ts" },
        position: { line: 1, character: 14 },
        context: { includeDeclaration: true },
      },
    },
  });

  const summary = handshake.summarise({
    stdoutText: stdoutForSymbolResponse({
      method: "textDocument/references",
      result: [
        { uri: "file:///workspace/src/app.ts", range: { start: { line: 1, character: 7 }, end: { line: 1, character: 26 } } },
        { uri: "file:///workspace/src/other.ts", range: { start: { line: 3, character: 1 }, end: { line: 3, character: 20 } } },
      ],
    }),
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.symbolResponseSummary.observed, true);
  assert.equal(summary.symbolResponseSummary.method, "textDocument/references");
  assert.equal(summary.symbolResponseSummary.resultKind, "array");
  assert.equal(summary.symbolResponseSummary.resultCount, 2);
  assert.equal(summary.symbolResponseSummary.uriCount, 2);
  assert.equal(summary.symbolResponseSummary.rangeCount, 2);
  assert.equal(summary.symbolResponseSummary.rawResultIncluded, false);
  assert.equal(JSON.stringify(summary).includes("other.ts"), false);
});

test("LSP symbol request handshake summarises hover contents by shape and size", () => {
  const handshake = createLspSymbolRequestHandshake({
    symbolRequest: {
      method: "textDocument/hover",
      params: {
        textDocument: { uri: "file:///workspace/src/app.ts" },
        position: { line: 1, character: 14 },
      },
    },
  });

  const summary = handshake.summarise({
    stdoutText: stdoutForSymbolResponse({
      method: "textDocument/hover",
      result: {
        contents: { kind: "markdown", value: "**OpenClaw hover detail**" },
        range: { start: { line: 1, character: 7 }, end: { line: 1, character: 26 } },
      },
    }),
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.symbolResponseSummary.observed, true);
  assert.equal(summary.symbolResponseSummary.method, "textDocument/hover");
  assert.equal(summary.symbolResponseSummary.resultKind, "object");
  assert.equal(summary.symbolResponseSummary.resultCount, 1);
  assert.equal(summary.symbolResponseSummary.rangeCount, 1);
  assert.equal(summary.symbolResponseSummary.hoverContentKind, "markdown");
  assert.equal(summary.symbolResponseSummary.hoverContentChars, 25);
  assert.equal(summary.symbolResponseSummary.rawResultIncluded, false);
  assert.equal(JSON.stringify(summary).includes("OpenClaw hover detail"), false);
});
