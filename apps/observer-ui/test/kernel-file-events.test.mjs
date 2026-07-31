import assert from "node:assert/strict";
import test from "node:test";

import { clientScript } from "../src/client-script.mjs";
import { observerSystemPanels } from "../src/observer-panels-system.mjs";

test("Observer exposes bounded file-open metadata without path fields", () => {
  const html = observerSystemPanels();
  const client = clientScript();
  for (const token of ["Kernel File Open Attempts", "kernel-file-open-events", "kernel-file-open-readback-json"]) {
    assert.match(html, new RegExp(token, "u"));
  }
  for (const token of ["/system/kernel/file-open-events", "refreshKernelFileOpenEvents", "kernelFileOpenUniqueFlagCount"]) {
    assert.match(client, new RegExp(token.replaceAll("/", "\\/"), "u"));
  }
  assert.doesNotMatch(client, /kernelFileOpenPath|kernelFileOpenFilename|kernelFileOpenContent/u);
});
