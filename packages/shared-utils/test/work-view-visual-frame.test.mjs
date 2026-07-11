import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  WORK_VIEW_VISUAL_FRAME_MAX_BYTES,
  projectWorkViewVisualFrame,
  unavailableWorkViewVisualFrame,
} from "../src/work-view-visual-frame.mjs";

function frameFor(bytes, overrides = {}) {
  return {
    registry: "openclaw-browser-visual-frame-v0",
    available: true,
    reason: null,
    sourceScope: "ai_owned_active_page_only",
    pageId: "page-1",
    pageUrl: "http://127.0.0.1/work-view",
    mediaType: "image/jpeg",
    encoding: "base64_data_url",
    width: 960,
    height: 540,
    byteLength: bytes.length,
    maxBytes: WORK_VIEW_VISUAL_FRAME_MAX_BYTES,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    capturedAt: "2026-07-10T10:00:00.000Z",
    sequence: 1,
    desktopWideCapture: false,
    persisted: false,
    dataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`,
    ...overrides,
  };
}

test("visual frame projection verifies bounded data and strips it from metadata", () => {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
  const frame = frameFor(bytes);
  const metadata = projectWorkViewVisualFrame(frame, {
    includeData: false,
    now: Date.parse("2026-07-10T10:00:01.000Z"),
  });
  assert.equal(metadata.available, true);
  assert.equal(metadata.fresh, true);
  assert.equal(metadata.dataExposed, false);
  assert.equal("dataUrl" in metadata, false);

  const full = projectWorkViewVisualFrame(frame, { includeData: true });
  assert.equal(full.available, true);
  assert.equal(full.dataUrl, frame.dataUrl);
  assert.equal(full.desktopWideCapture, false);
  assert.equal(full.persisted, false);
});

test("visual frame projection fails closed on oversized or altered payloads", () => {
  const oversized = frameFor(Buffer.alloc(WORK_VIEW_VISUAL_FRAME_MAX_BYTES + 1));
  assert.equal(projectWorkViewVisualFrame(oversized, { includeData: true }).reason, "invalid_frame_contract");

  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
  const altered = frameFor(bytes, { dataUrl: "data:image/jpeg;base64,AAAA" });
  assert.equal(projectWorkViewVisualFrame(altered, { includeData: true }).reason, "invalid_frame_data");
  assert.deepEqual(
    unavailableWorkViewVisualFrame("browser_not_running").sourceScope,
    "ai_owned_active_page_only",
  );
});
