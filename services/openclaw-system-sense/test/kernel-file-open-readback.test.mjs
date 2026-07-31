import assert from "node:assert/strict";
import test from "node:test";

import { buildKernelFileOpenReadback, createKernelFileOpenReadback } from "../src/kernel-file-open-readback.mjs";

test("kernel file-open readback summarizes bounded process, flags, and continuity metadata", () => {
  const events = [
    { pid: 1, uid: 1000, comm: "touch", flags: "577", mode: "420" },
    { pid: 2, uid: 1000, comm: "touch", flags: "577", mode: "420" },
    { pid: 3, uid: 1001, comm: "cat", flags: "0", mode: "0" },
  ];
  const readback = buildKernelFileOpenReadback({ events, captureWindowMs: 1000, eventLimit: 128 });
  assert.equal(readback.eventCount, 3);
  assert.equal(readback.uniqueCommCount, 2);
  assert.equal(readback.uniqueFlagCount, 2);
  assert.deepEqual(readback.commCounts[0], { comm: "touch", count: 2 });
  assert.equal(readback.pathCaptured, false);
  assert.equal(readback.contentCaptured, false);
  assert.equal(readback.persisted, false);

  const build = createKernelFileOpenReadback();
  const first = build({ events, captureStatus: "captured" });
  const second = build({ events: [events[2]], captureStatus: "captured" });
  assert.equal(first.continuity.captureSequence, 1);
  assert.equal(second.continuity.captureSequence, 2);
  assert.equal(second.continuity.status, "compared");
  assert.equal(second.continuity.newCommCount, 0);
});
