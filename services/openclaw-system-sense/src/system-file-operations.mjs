import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;

export function createSystemFileOperations({
  allowedRoots = [],
  maxFileListLimit = 100,
  maxSearchLimit = 100,
  maxSearchDepth = 4,
  maxFileReadBytes = 65536,
  maxFileWriteBytes = 65536,
} = {}) {
function normaliseForBoundary(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function lstatOrNull(filePath) {
  try {
    return lstatSync(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function nearestExistingPath(filePath) {
  let current = filePath;
  while (true) {
    if (lstatOrNull(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function assertNoSymlinkComponents(candidate, root) {
  let current = candidate;
  const normalisedRoot = normaliseForBoundary(root);
  while (true) {
    const stats = lstatOrNull(current);
    if (stats?.isSymbolicLink()) {
      const error = new Error("OpenClaw file paths must not contain symbolic links.");
      error.code = "PATH_SYMLINK_NOT_ALLOWED";
      error.details = { path: candidate, symlinkPath: current };
      throw error;
    }
    if (normaliseForBoundary(current) === normalisedRoot) {
      return;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  const error = new Error("OpenClaw file path could not be anchored to an allowed root.");
  error.code = "PATH_ROOT_ANCHOR_FAILED";
  throw error;
}

function assertRealPathWithinRoot(candidate, root) {
  const existingPath = nearestExistingPath(candidate);
  if (!existingPath) {
    const error = new Error("OpenClaw file path has no existing parent.");
    error.code = "PATH_PARENT_NOT_FOUND";
    throw error;
  }
  const realRoot = realpathSync(root);
  const realExisting = realpathSync(existingPath);
  const normalisedRoot = normaliseForBoundary(realRoot);
  const normalisedExisting = normaliseForBoundary(realExisting);
  if (normalisedExisting !== normalisedRoot && !normalisedExisting.startsWith(`${normalisedRoot}${path.sep}`)) {
    const error = new Error("Resolved OpenClaw file path is outside the allowed root.");
    error.code = "PATH_REALPATH_OUTSIDE_ALLOWED_ROOTS";
    error.details = { path: candidate, root };
    throw error;
  }
}

function resolveAllowedPath(inputPath = null) {
  const rawPath = typeof inputPath === "string" && inputPath.trim()
    ? inputPath.trim()
    : allowedRoots[0];
  const candidate = path.resolve(rawPath);
  const normalisedCandidate = normaliseForBoundary(candidate);
  const root = allowedRoots.find((allowedRoot) => {
    const normalisedRoot = normaliseForBoundary(allowedRoot);
    return normalisedCandidate === normalisedRoot
      || normalisedCandidate.startsWith(`${normalisedRoot}${path.sep}`);
  });

  if (!root) {
    const error = new Error("Path is outside allowed OpenClaw system-sense roots.");
    error.code = "PATH_OUTSIDE_ALLOWED_ROOTS";
    error.details = { path: candidate, allowedRoots };
    throw error;
  }

  assertNoSymlinkComponents(candidate, root);
  assertRealPathWithinRoot(candidate, root);

  return {
    requestedPath: rawPath,
    path: candidate,
    root,
  };
}

function classifyFile(stats) {
  if (stats.isDirectory()) {
    return "directory";
  }
  if (stats.isFile()) {
    return "file";
  }
  if (stats.isSymbolicLink()) {
    return "symlink";
  }
  return "other";
}

function buildFileMetadataFromStats(filePath, stats) {
  return {
    path: filePath,
    name: path.basename(filePath),
    type: classifyFile(stats),
    sizeBytes: stats.size,
    mode: stats.mode,
    modifiedAt: stats.mtime.toISOString(),
    createdAt: stats.birthtime.toISOString(),
    readable: true,
  };
}

function buildFileMetadata(filePath) {
  return buildFileMetadataFromStats(filePath, lstatSync(filePath));
}

function listFiles(inputPath, limit) {
  const resolved = resolveAllowedPath(inputPath);
  if (!lstatOrNull(resolved.path)) {
    const error = new Error("Path does not exist.");
    error.code = "PATH_NOT_FOUND";
    throw error;
  }

  const metadata = buildFileMetadata(resolved.path);
  if (metadata.type !== "directory") {
    return {
      ...resolved,
      directory: metadata,
      entries: [metadata],
      count: 1,
    };
  }

  const safeLimit = Math.max(1, Math.min(Number.isFinite(limit) ? limit : 50, maxFileListLimit));
  const entries = readdirSync(resolved.path)
    .slice(0, safeLimit)
    .map((entryName) => {
      const entryPath = path.join(resolved.path, entryName);
      try {
        return buildFileMetadata(entryPath);
      } catch {
        return {
          path: entryPath,
          name: entryName,
          type: "unreadable",
          readable: false,
        };
      }
    })
    .sort((left, right) => String(left.type).localeCompare(String(right.type)) || left.name.localeCompare(right.name));

  return {
    ...resolved,
    directory: metadata,
    entries,
    count: entries.length,
    limit: safeLimit,
  };
}

function searchFiles(inputPath, query, limit) {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("Search query is required.");
  }

  const resolved = resolveAllowedPath(inputPath);
  const safeLimit = Math.max(1, Math.min(Number.isFinite(limit) ? limit : 50, maxSearchLimit));
  const needle = query.trim().toLowerCase();
  const results = [];

  function visit(currentPath, depth) {
    if (results.length >= safeLimit || depth > maxSearchDepth) {
      return;
    }

    let stats;
    try {
      stats = lstatSync(currentPath);
    } catch {
      return;
    }

    const name = path.basename(currentPath);
    if (name.toLowerCase().includes(needle)) {
      results.push(buildFileMetadata(currentPath));
      if (results.length >= safeLimit) {
        return;
      }
    }

    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      return;
    }

    for (const entryName of readdirSync(currentPath)) {
      visit(path.join(currentPath, entryName), depth + 1);
      if (results.length >= safeLimit) {
        return;
      }
    }
  }

  visit(resolved.path, 0);
  return {
    ...resolved,
    query: query.trim(),
    results,
    count: results.length,
    limit: safeLimit,
    maxDepth: maxSearchDepth,
  };
}

function readTextFile(inputPath) {
  const resolved = resolveAllowedPath(inputPath);
  if (!lstatOrNull(resolved.path)) {
    const error = new Error("Path does not exist.");
    error.code = "PATH_NOT_FOUND";
    throw error;
  }

  let fd;
  try {
    fd = openSync(resolved.path, constants.O_RDONLY | NO_FOLLOW);
    const metadata = buildFileMetadataFromStats(resolved.path, fstatSync(fd));
    if (metadata.type !== "file") {
      const error = new Error("Text reads require a regular file.");
      error.code = "TARGET_NOT_FILE";
      error.details = { path: resolved.path, type: metadata.type };
      throw error;
    }
    if (metadata.sizeBytes > maxFileReadBytes) {
      const error = new Error("Text read exceeds OpenClaw file read limit.");
      error.code = "FILE_READ_LIMIT_EXCEEDED";
      error.details = { sizeBytes: metadata.sizeBytes, maxFileReadBytes };
      throw error;
    }

    const content = readFileSync(fd, "utf8");
    return {
      ...resolved,
      mode: "read_text",
      encoding: "utf8",
      content,
      contentBytes: Buffer.byteLength(content, "utf8"),
      metadata,
    };
  } catch (error) {
    if (error?.code === "ELOOP") {
      error.code = "PATH_SYMLINK_NOT_ALLOWED";
    }
    throw error;
  } finally {
    if (fd !== undefined) {
      closeSync(fd);
    }
  }
}

function writeTextFile(body = {}) {
  const targetPath = typeof body.path === "string" && body.path.trim()
    ? body.path.trim()
    : null;
  if (!targetPath) {
    const error = new Error("File path is required for write-text.");
    error.code = "FILE_PATH_REQUIRED";
    throw error;
  }

  const content = typeof body.content === "string" ? body.content : "";
  const encoding = typeof body.encoding === "string" && body.encoding.trim() ? body.encoding.trim() : "utf8";
  if (encoding !== "utf8") {
    const error = new Error("Only utf8 text writes are supported.");
    error.code = "UNSUPPORTED_ENCODING";
    throw error;
  }

  const contentBytes = Buffer.byteLength(content, "utf8");
  if (contentBytes > maxFileWriteBytes) {
    const error = new Error("Text write exceeds OpenClaw file write limit.");
    error.code = "FILE_WRITE_LIMIT_EXCEEDED";
    error.details = { contentBytes, maxFileWriteBytes };
    throw error;
  }

  const resolved = resolveAllowedPath(targetPath);
  const parentPath = path.dirname(resolved.path);
  // H-4 note: This call intentionally discards the return value. Its purpose
  // is boundary validation only; it throws if parentPath falls outside the
  // allowed roots. On NixOS the path check is correct and complete.
  resolveAllowedPath(parentPath);
  if (!lstatOrNull(parentPath)?.isDirectory()) {
    const error = new Error("Parent directory must exist inside allowed roots.");
    error.code = "PARENT_DIRECTORY_NOT_FOUND";
    error.details = { parentPath };
    throw error;
  }

  const existingStats = lstatOrNull(resolved.path);
  const existedBefore = Boolean(existingStats);
  if (existingStats?.isDirectory()) {
    const error = new Error("Cannot write text over a directory.");
    error.code = "TARGET_IS_DIRECTORY";
    throw error;
  }
  if (existedBefore && body.overwrite === false) {
    const error = new Error("Target file exists and overwrite is disabled.");
    error.code = "TARGET_EXISTS";
    throw error;
  }

  let fd;
  try {
    const flags = constants.O_WRONLY
      | constants.O_CREAT
      | (existedBefore ? constants.O_TRUNC : constants.O_EXCL)
      | NO_FOLLOW;
    fd = openSync(resolved.path, flags, 0o600);
    writeFileSync(fd, content, { encoding });
    const metadata = buildFileMetadataFromStats(resolved.path, fstatSync(fd));
    if (metadata.type !== "file") {
      const error = new Error("Text writes require a regular file target.");
      error.code = "TARGET_NOT_FILE";
      throw error;
    }
    return {
      ...resolved,
      mode: "write_text",
      contentBytes,
      encoding,
      overwrite: existedBefore,
      metadata,
    };
  } catch (error) {
    if (error?.code === "ELOOP") {
      error.code = "PATH_SYMLINK_NOT_ALLOWED";
    }
    throw error;
  } finally {
    if (fd !== undefined) {
      closeSync(fd);
    }
  }
}

function appendTextFile(body = {}) {
  const targetPath = typeof body.path === "string" && body.path.trim()
    ? body.path.trim()
    : null;
  if (!targetPath) {
    const error = new Error("File path is required for append-text.");
    error.code = "FILE_PATH_REQUIRED";
    throw error;
  }

  const content = typeof body.content === "string" ? body.content : "";
  const encoding = typeof body.encoding === "string" && body.encoding.trim() ? body.encoding.trim() : "utf8";
  if (encoding !== "utf8") {
    const error = new Error("Only utf8 text appends are supported.");
    error.code = "UNSUPPORTED_ENCODING";
    throw error;
  }

  const contentBytes = Buffer.byteLength(content, "utf8");
  const resolved = resolveAllowedPath(targetPath);
  const createIfMissing = body.createIfMissing === true;
  if (!lstatOrNull(resolved.path)) {
    if (!createIfMissing) {
      const error = new Error("Target file must exist for append-text.");
      error.code = "TARGET_NOT_FOUND";
      throw error;
    }
    const parentPath = path.dirname(resolved.path);
    resolveAllowedPath(parentPath);
    if (!lstatOrNull(parentPath)?.isDirectory()) {
      const error = new Error("Parent directory must exist inside allowed roots.");
      error.code = "PARENT_DIRECTORY_NOT_FOUND";
      error.details = { parentPath };
      throw error;
    }
  }

  const existingStats = lstatOrNull(resolved.path);
  const existedBefore = Boolean(existingStats);
  if (existingStats && !existingStats.isFile()) {
    const error = new Error("Cannot append text to a non-file target.");
    error.code = "TARGET_NOT_FILE";
    throw error;
  }

  const previousBytes = existingStats?.size ?? 0;
  const totalBytes = previousBytes + contentBytes;
  if (totalBytes > maxFileWriteBytes) {
    const error = new Error("Text append exceeds OpenClaw file write limit.");
    error.code = "FILE_WRITE_LIMIT_EXCEEDED";
    error.details = { previousBytes, contentBytes, totalBytes, maxFileWriteBytes };
    throw error;
  }

  let fd;
  try {
    const flags = constants.O_WRONLY | constants.O_APPEND | NO_FOLLOW
      | (existedBefore ? 0 : constants.O_CREAT | constants.O_EXCL);
    fd = openSync(resolved.path, flags, 0o600);
    writeFileSync(fd, content, { encoding });
    const metadata = buildFileMetadataFromStats(resolved.path, fstatSync(fd));
    if (metadata.type !== "file") {
      const error = new Error("Text appends require a regular file target.");
      error.code = "TARGET_NOT_FILE";
      throw error;
    }
    return {
      ...resolved,
      mode: "append_text",
      contentBytes,
      previousBytes,
      totalBytes,
      encoding,
      created: !existedBefore,
      createIfMissing,
      metadata,
    };
  } catch (error) {
    if (error?.code === "ELOOP") {
      error.code = "PATH_SYMLINK_NOT_ALLOWED";
    }
    throw error;
  } finally {
    if (fd !== undefined) {
      closeSync(fd);
    }
  }
}

function createDirectory(body = {}) {
  const targetPath = typeof body.path === "string" && body.path.trim()
    ? body.path.trim()
    : null;
  if (!targetPath) {
    const error = new Error("Directory path is required.");
    error.code = "DIRECTORY_PATH_REQUIRED";
    throw error;
  }

  const resolved = resolveAllowedPath(targetPath);
  const recursive = body.recursive === true;
  const parentPath = path.dirname(resolved.path);
  resolveAllowedPath(parentPath);
  if (!recursive && (!lstatOrNull(parentPath) || !lstatOrNull(parentPath).isDirectory())) {
    const error = new Error("Parent directory must exist inside allowed roots.");
    error.code = "PARENT_DIRECTORY_NOT_FOUND";
    error.details = { parentPath };
    throw error;
  }

  const existingStats = lstatOrNull(resolved.path);
  const existedBefore = Boolean(existingStats);
  if (existedBefore && !existingStats.isDirectory()) {
    const error = new Error("Target path exists and is not a directory.");
    error.code = "TARGET_NOT_DIRECTORY";
    throw error;
  }

  mkdirSync(resolved.path, { recursive });
  resolveAllowedPath(resolved.path);
  const metadata = buildFileMetadata(resolved.path);
  return {
    ...resolved,
    mode: "mkdir",
    recursive,
    created: !existedBefore,
    metadata,
  };
}


  return {
    resolveAllowedPath,
    buildFileMetadata,
    listFiles,
    searchFiles,
    readTextFile,
    writeTextFile,
    appendTextFile,
    createDirectory,
  };
}
