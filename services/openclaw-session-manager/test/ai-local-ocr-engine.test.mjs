import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  createAiLocalOcrEngine,
  parseTesseractTsv,
} from "../src/ai-local-ocr-engine.mjs";

const header = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";

function tsv(...rows) {
  return `${header}\n${rows.join("\n")}\n`;
}

function row({ line = 1, word = 1, left = 10, text = "Customer", confidence = 95 } = {}) {
  return `5\t1\t1\t1\t${line}\t${word}\t${left}\t20\t80\t24\t${confidence}\t${text}`;
}

test("Tesseract TSV is grouped into bounded text lines", () => {
  const parsed = parseTesseractTsv(tsv(
    row(),
    row({ word: 2, left: 100, text: "name" }),
    row({ line: 2, left: 10, text: "ignored", confidence: 20 }),
  ));

  assert.equal(parsed.sourceItemCount, 1);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].text, "Customer name");
  assert.deepEqual(parsed.items[0].bounds, { x: 10, y: 20, width: 170, height: 24 });
  assert.equal(parsed.truncated, false);
});

test("local OCR engine passes only PNG bytes over the fixed process transport", async () => {
  const bytes = Buffer.from("bounded png fixture");
  const calls = [];
  const engine = createAiLocalOcrEngine({
    env: {
      OPENCLAW_AI_LOCAL_OCR_ENABLED: "1",
      OPENCLAW_AI_LOCAL_OCR_TESSERACT_PATH: "/nix/store/aaaaaaaa-tesseract-5.5.2/bin/tesseract",
      OPENCLAW_AI_LOCAL_OCR_TIMEOUT_MS: "1000",
    },
    runProcess: async (request) => {
      calls.push(request);
      return tsv(row({ text: "NixSoma" }));
    },
  });
  const result = await engine.recognize({
    dataExposed: true,
    dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
    byteLength: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: 1280,
    height: 720,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].executable, "/nix/store/aaaaaaaa-tesseract-5.5.2/bin/tesseract");
  assert.deepEqual(calls[0].input, bytes);
  assert.equal(result.items[0].text, "NixSoma");
  assert.equal(JSON.stringify(engine.config()).includes("NixSoma"), false);
});

test("local OCR engine rejects an unbound frame or mutable executable", async () => {
  const engine = createAiLocalOcrEngine({
    env: {
      OPENCLAW_AI_LOCAL_OCR_ENABLED: "1",
      OPENCLAW_AI_LOCAL_OCR_TESSERACT_PATH: "/usr/bin/tesseract",
    },
    runProcess: async () => "",
  });
  await assert.rejects(
    () => engine.recognize({}),
    /fixed Nix-store path/u,
  );
});
