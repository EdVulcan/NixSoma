import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  AI_COMPOSITOR_FRAME_REGISTRY,
  projectAiCompositorFrame,
} from "../src/ai-compositor-frame.mjs";

function frameFor(bytes) {
  return {
    registry: AI_COMPOSITOR_FRAME_REGISTRY,
    available: true,
    sourceScope: "ai_owned_nested_output_only",
    captureApi: "weston_output_capture_v1",
    socketName: "nixsoma-ai-0",
    mediaType: "image/png",
    encoding: "base64_data_url",
    width: 1280,
    height: 720,
    byteLength: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    capturedAt: new Date().toISOString(),
    sequence: 1,
    browserScreenshotApi: false,
    desktopWideCapture: false,
    parentDisplayConnected: false,
    inputAuthority: false,
    persisted: false,
    dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
  };
}

test("compositor frame projection validates data and strips it from evidence", () => {
  const bytes = Buffer.from("bounded native output frame");
  const frame = frameFor(bytes);
  const metadata = projectAiCompositorFrame(frame, { width: 1280, height: 720 });
  assert.equal(metadata.available, true);
  assert.equal(metadata.dataExposed, false);
  assert.equal("dataUrl" in metadata, false);

  const full = projectAiCompositorFrame(frame, { includeData: true, width: 1280, height: 720 });
  assert.equal(full.available, true);
  assert.equal(full.dataUrl, frame.dataUrl);

  const changed = projectAiCompositorFrame(
    { ...frame, dataUrl: "data:image/png;base64,AAAA" },
    { includeData: true, width: 1280, height: 720 },
  );
  assert.equal(changed.available, false);
  assert.equal(changed.reason, "invalid_frame_data");
});
