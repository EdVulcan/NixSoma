import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createNativeDeclarativeEvolutionExecution } from "../src/native-declarative-evolution-execution.mjs";

function hash(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

test("declarative evolution execution stages only the approved candidate hash and runs read-only Nix checks", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openclaw-declarative-execution-test-"));
  const candidateText = "{ lib, ... }: { services.openclaw.components = lib.mkAfter [ \"core\" ]; }\n";
  const candidateHash = hash(candidateText);
  const calls = [];
  try {
    const execution = createNativeDeclarativeEvolutionExecution({
      stagingDir: path.join(root, "staging"),
      flakePath: "/private/flake",
      baseModulePath: "/private/flake/nix/hosts/local-dev.nix",
      buildMode: "dry-run",
      validateCandidateFile: async (candidatePath) => {
        calls.push({ name: "validateCandidateFile", candidatePath });
        return { status: "passed", mode: "nix-instantiate" };
      },
      runNixCommand: async (args) => {
          calls.push({ name: args.includes("eval") ? "eval" : "build", args });
          if (args.includes("eval")) {
            return {
              status: "passed",
            stdout: JSON.stringify({
              candidateType: "lambda",
              components: ["core"],
              toplevelPath: "/nix/store/abc123-openclaw-system",
              toplevelEvaluated: true,
            }),
          };
        }
        return { status: "passed", stdout: "/nix/store/abc123-openclaw-system\n" };
      },
    });

    const result = await execution.executeNativeDeclarativeEvolutionCandidate({ candidateText, candidateHash });
    assert.equal(result.status, "passed");
    assert.equal(result.staging.candidateHash, candidateHash);
    assert.match(result.staging.path, new RegExp(`${candidateHash}\\.nix$`));
    assert.equal(await readFile(result.staging.path, "utf8"), candidateText);
    assert.equal(result.evaluation.status, "passed");
    assert.equal(result.evaluation.toplevelPath, "/nix/store/abc123-openclaw-system");
    assert.equal(result.build.mode, "nix-build-dry-run");
    assert.equal(result.build.outputPath, "/nix/store/abc123-openclaw-system");
    assert.equal(result.governance.writesManagedConfig, false);
    assert.equal(result.governance.switchesGeneration, false);
    assert.equal(result.governance.executesRollback, false);
    assert.equal(JSON.stringify(result).includes(candidateText), false);
    assert.equal(calls.filter((call) => call.name === "validateCandidateFile").length, 1);
    assert.equal(calls.filter((call) => call.name === "eval").length, 1);
    assert.equal(calls.filter((call) => call.name === "build").length, 1);
    assert.equal(calls.every((call) => JSON.stringify(call).includes(result.staging.path)), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("declarative evolution execution rejects a candidate body whose hash was changed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openclaw-declarative-execution-mismatch-"));
  try {
    const execution = createNativeDeclarativeEvolutionExecution({ stagingDir: root });
    await assert.rejects(
      () => execution.stageCandidate({ candidateText: "changed", candidateHash: "a".repeat(64) }),
      /hash does not match candidate text/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("declarative evolution execution refuses /etc/nixos as a staging owner", () => {
  assert.throws(
    () => createNativeDeclarativeEvolutionExecution({ stagingDir: "/etc/nixos" }),
    /outside \/etc\/nixos/,
  );
});
