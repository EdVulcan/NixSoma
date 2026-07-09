import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { createNativeEngineeringReadSearchBuilders } from "../src/native-engineering-read-search-builders.mjs";
import {
  createNativeEngineeringWriteProposalBuilders,
  NATIVE_ENGINEERING_WRITE_PROPOSAL_REGISTRY,
} from "../src/native-engineering-write-proposal-builders.mjs";

const OLD_SECRET = "WRITE_PROPOSAL_OLD_SECRET_DO_NOT_LEAK";
const NEW_SECRET = "WRITE_PROPOSAL_NEW_SECRET_DO_NOT_LEAK";

function safeStat(filePath) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openclaw-engineering-write-proposal-"));
  mkdirSync(path.join(root, "src"), { recursive: true });
  mkdirSync(path.join(root, ".cache"), { recursive: true });
  writeFileSync(path.join(root, "src", "existing.txt"), `old line\n${OLD_SECRET}\n`);
  writeFileSync(path.join(root, ".cache", "hidden.txt"), "hidden\n");
  return root;
}

function createHarness(root) {
  const workspaceSelector = () => ({
    registry: { registry: "openclaw-source-workspace-v0" },
    item: {
      id: "fixture",
      name: "Write Proposal Fixture",
      path: root,
    },
  });
  const readSearch = createNativeEngineeringReadSearchBuilders({
    safeStat,
    selectOpenClawToolCatalogWorkspace: workspaceSelector,
  });
  return createNativeEngineeringWriteProposalBuilders({
    buildNativeEngineeringReadFile: readSearch.buildNativeEngineeringReadFile,
    safeStat,
    selectOpenClawToolCatalogWorkspace: workspaceSelector,
  });
}

test("native engineering write proposal builds redacted create preview without writing", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root);

  const proposal = builders.buildNativeEngineeringWriteProposal({
    relativePath: "src/new-file.txt",
    content: `new line\n${NEW_SECRET}\n`,
    overwrite: false,
  });
  const raw = JSON.stringify(proposal);

  assert.equal(proposal.ok, true);
  assert.equal(proposal.registry, NATIVE_ENGINEERING_WRITE_PROPOSAL_REGISTRY);
  assert.equal(proposal.mode, "source-write-proposal-diff-metadata-preview-only");
  assert.equal(proposal.capability.id, "act.openclaw.engineering_tool.write_proposal");
  assert.equal(proposal.sourceCapability.sourceToolName, "cc_write");
  assert.equal(proposal.summary.proposalKind, "create_file_proposal");
  assert.equal(proposal.summary.createsTask, false);
  assert.equal(proposal.summary.createsApproval, false);
  assert.equal(proposal.governance.canWriteFile, false);
  assert.equal(proposal.governance.requiresApprovalBeforeWrite, true);
  assert.equal(proposal.target.exists, false);
  assert.equal(proposal.target.contentExposed, false);
  assert.equal(proposal.target.diffPreviewTextExposed, false);
  assert.equal(proposal.diffPreview.contentExposed, false);
  assert.equal(proposal.diffPreview.lines.every((line) => line.textRedacted === true), true);
  assert.equal(raw.includes(NEW_SECRET), false);
  assert.equal(safeStat(path.join(root, "src", "new-file.txt")), null);
});

test("native engineering write proposal builds redacted overwrite metadata", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root);

  const proposal = builders.buildNativeEngineeringWriteProposal({
    relativePath: "src/existing.txt",
    content: `replacement\n${NEW_SECRET}\n`,
    overwrite: true,
  });
  const raw = JSON.stringify(proposal);

  assert.equal(proposal.ok, true);
  assert.equal(proposal.summary.proposalKind, "overwrite_file_proposal");
  assert.equal(proposal.target.exists, true);
  assert.equal(typeof proposal.target.existingSha256, "string");
  assert.equal(typeof proposal.target.proposedSha256, "string");
  assert.equal(proposal.validation.target.overwriteAllowedByRequest, true);
  assert.equal(proposal.diffPreview.lines.some((line) => line.type === "remove"), true);
  assert.equal(proposal.diffPreview.lines.some((line) => line.type === "add"), true);
  assert.equal(raw.includes(OLD_SECRET), false);
  assert.equal(raw.includes(NEW_SECRET), false);
});

test("native engineering write proposal blocks existing target without overwrite", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root);

  const proposal = builders.buildNativeEngineeringWriteProposal({
    relativePath: "src/existing.txt",
    content: `replacement\n${NEW_SECRET}\n`,
    overwrite: false,
  });

  assert.equal(proposal.ok, false);
  assert.equal(proposal.blocked, true);
  assert.equal(proposal.target.blockedReason, "target_exists_overwrite_false");
  assert.equal(proposal.summary.createsTask, false);
  assert.equal(proposal.governance.canMutate, false);
});

test("native engineering write proposal rejects traversal and hidden/cache directories", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builders = createHarness(root);

  assert.throws(
    () => builders.buildNativeEngineeringWriteProposal({
      relativePath: "../outside.txt",
      content: "outside\n",
    }),
    /workspace/i,
  );
  assert.throws(
    () => builders.buildNativeEngineeringWriteProposal({
      relativePath: ".cache/hidden.txt",
      content: "hidden\n",
    }),
    /hidden\/generated\/cache/i,
  );
});
