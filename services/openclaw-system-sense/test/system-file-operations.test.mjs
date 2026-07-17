import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { createSystemFileOperations } from "../src/system-file-operations.mjs";

function withTempRoot(callback) {
  const root = mkdtempSync(path.join(os.tmpdir(), "openclaw-system-file-"));
  try {
    return callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("system file operations preserve bounded local filesystem read/write behavior", () => {
  withTempRoot((root) => {
    const operations = createSystemFileOperations({
      allowedRoots: [root],
      maxFileListLimit: 10,
      maxSearchLimit: 10,
      maxSearchDepth: 3,
      maxFileReadBytes: 64,
      maxFileWriteBytes: 64,
    });
    const workspacePath = path.join(root, "workspace");
    const targetPath = path.join(workspacePath, "process-note.txt");

    const createdDirectory = operations.createDirectory({ path: workspacePath });
    const writeResult = operations.writeTextFile({
      path: targetPath,
      content: "openclaw",
      overwrite: false,
    });
    const appendResult = operations.appendTextFile({
      path: targetPath,
      content: "-body",
    });
    const readResult = operations.readTextFile(targetPath);
    const listResult = operations.listFiles(workspacePath, 10);
    const searchResult = operations.searchFiles(root, "process-note", 10);

    assert.equal(createdDirectory.mode, "mkdir");
    assert.equal(writeResult.mode, "write_text");
    assert.equal(appendResult.mode, "append_text");
    assert.equal(appendResult.totalBytes, Buffer.byteLength("openclaw-body", "utf8"));
    assert.equal(readResult.content, "openclaw-body");
    assert.equal(listResult.entries[0].name, "process-note.txt");
    assert.equal(searchResult.results[0].path, targetPath);
  });
});

test("system file operations reject boundary escapes and oversized writes", () => {
  withTempRoot((root) => {
    const operations = createSystemFileOperations({
      allowedRoots: [root],
      maxFileWriteBytes: 4,
    });

    assert.throws(
      () => operations.resolveAllowedPath(path.dirname(root)),
      (error) => error?.code === "PATH_OUTSIDE_ALLOWED_ROOTS",
    );
    assert.throws(
      () => operations.writeTextFile({ path: path.join(root, "large.txt"), content: "too-large" }),
      (error) => error?.code === "FILE_WRITE_LIMIT_EXCEEDED",
    );
  });
});

test("system file operations reject symlink escapes for reads, writes, and search traversal", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openclaw-system-file-root-"));
  const outside = mkdtempSync(path.join(os.tmpdir(), "openclaw-system-file-outside-"));
  try {
    const outsideFile = path.join(outside, "secret.txt");
    const link = path.join(root, "secret.txt");
    writeFileSync(outsideFile, "outside-root", "utf8");
    symlinkSync(outsideFile, link);
    const operations = createSystemFileOperations({ allowedRoots: [root] });

    assert.throws(
      () => operations.resolveAllowedPath(link),
      (error) => error?.code === "PATH_SYMLINK_NOT_ALLOWED",
    );
    assert.throws(
      () => operations.readTextFile(link),
      (error) => error?.code === "PATH_SYMLINK_NOT_ALLOWED",
    );
    assert.throws(
      () => operations.writeTextFile({ path: link, content: "must-not-follow" }),
      (error) => error?.code === "PATH_SYMLINK_NOT_ALLOWED",
    );
    const search = operations.searchFiles(root, "secret", 10);
    assert.equal(search.results.length, 1);
    assert.equal(search.results[0].type, "symlink");
    assert.equal(search.results[0].path, link);
    assert.equal(search.results.some((result) => result.path === outsideFile), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
