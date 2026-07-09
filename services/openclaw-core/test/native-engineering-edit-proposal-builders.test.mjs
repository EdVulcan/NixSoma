import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { createNativeEngineeringEditProposalBuilders } from "../src/native-engineering-edit-proposal-builders.mjs";
import { createNativeEngineeringReadSearchBuilders } from "../src/native-engineering-read-search-builders.mjs";

function safeStat(filePath) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openclaw-engineering-edit-proposal-"));
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(
    path.join(root, "src", "target.ts"),
    [
      "export const alpha = 'before';",
      "export const beta = 'unique target';",
      "export const gamma = 'after';",
    ].join("\n"),
  );
  writeFileSync(path.join(root, "src", "duplicate.ts"), "same\nsame\n");
  writeFileSync(path.join(root, "src", "large.txt"), "x".repeat(4096));
  return root;
}

function createHarness(root) {
  const readSearch = createNativeEngineeringReadSearchBuilders({
    safeStat,
    selectOpenClawToolCatalogWorkspace: () => ({
      registry: {
        registry: "openclaw-source-workspace-v0",
      },
      item: {
        id: "fixture",
        name: "Edit Proposal Fixture",
        path: root,
      },
    }),
  });
  return createNativeEngineeringEditProposalBuilders({
    buildNativeEngineeringReadFile: readSearch.buildNativeEngineeringReadFile,
  });
}

test("native engineering edit proposal builds exact-match diff preview without applying", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root);

  const proposal = builders.buildNativeEngineeringEditProposal({
    relativePath: "src/target.ts",
    oldString: "unique target",
    newString: "renamed target",
    contextLines: 1,
  });
  const raw = JSON.stringify(proposal);

  assert.equal(proposal.ok, true);
  assert.equal(proposal.registry, "openclaw-native-engineering-edit-proposal-v0");
  assert.equal(proposal.mode, "surgical-edit-proposal-diff-preview-only");
  assert.equal(proposal.capability.id, "act.openclaw.engineering_tool.edit_proposal");
  assert.equal(proposal.validation.exactReplacement.uniqueExactMatch, true);
  assert.equal(proposal.summary.replacementsAvailable, 1);
  assert.equal(proposal.summary.canMutate, false);
  assert.equal(proposal.summary.createsTask, false);
  assert.equal(proposal.summary.createsApproval, false);
  assert.equal(proposal.governance.canApplyPatch, false);
  assert.equal(proposal.governance.requiresApprovalBeforeApply, true);
  assert.equal(proposal.diffPreview.format, "bounded-line-diff-v0");
  assert.equal(proposal.diffPreview.lines.some((line) => line.type === "remove" && line.text.includes("unique target")), true);
  assert.equal(proposal.diffPreview.lines.some((line) => line.type === "add" && line.text.includes("renamed target")), true);
  assert.equal(raw.includes("renamed target"), true);
  assert.equal(proposal.auditEvidence.evidenceKind, "response_embedded_audit_evidence");
});

test("native engineering edit proposal rejects non-unique exact replacements", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root);

  assert.throws(
    () => builders.buildNativeEngineeringEditProposal({
      relativePath: "src/duplicate.ts",
      oldString: "same",
      newString: "once",
    }),
    /exactly one match; found 2/u,
  );
});

test("native engineering edit proposal refuses blocked read targets", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root);

  assert.throws(
    () => builders.buildNativeEngineeringEditProposal({
      relativePath: "src/large.txt",
      oldString: "x",
      newString: "y",
      maxFileSizeBytes: 256,
    }),
    /cannot read target/u,
  );
});
