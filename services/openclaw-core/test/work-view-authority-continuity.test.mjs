import test from "node:test";
import assert from "node:assert/strict";

import {
  invokeWorkViewAuthority,
  isWorkViewAuthorityInterruption,
  serialiseWorkViewAuthorityInterruption,
} from "../src/work-view-authority-continuity.mjs";

test("work-view authority wrapper classifies dependency interruption without exposing cause details", async () => {
  let error;
  try {
    await invokeWorkViewAuthority("prepare", async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:4102");
    });
  } catch (caught) {
    error = caught;
  }
  assert.equal(isWorkViewAuthorityInterruption(error), true);
  assert.deepEqual(serialiseWorkViewAuthorityInterruption(error), {
    kind: "work-view-authority-interruption",
    code: "work_view_authority_interruption",
    stage: "prepare",
    recoverable: true,
    automaticRestart: false,
    recoveryAction: "restore_trusted_work_view_then_recover_task",
  });
});
