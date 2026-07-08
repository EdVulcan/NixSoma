import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { clientScript } from "../src/client-script.mjs";

const tempDir = mkdtempSync(join(tmpdir(), "openclaw-observer-client-"));
const clientFile = join(tempDir, "client.js");

try {
  writeFileSync(clientFile, clientScript());
  execFileSync(process.execPath, ["--check", clientFile], { stdio: "inherit" });
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}
