import test from "node:test";
import assert from "node:assert/strict";

import { createSystemCommandOperations } from "../src/system-command-operations.mjs";

function createOperations(overrides = {}) {
  return createSystemCommandOperations({
    commandAllowlist: ["echo", "printf"],
    commandTimeoutMs: 500,
    commandOutputLimit: 5,
    defaultCwd: "/workspace",
    resolveAllowedPath: (inputPath) => {
      const resolved = inputPath ?? "/workspace";
      if (!String(resolved).startsWith("/workspace")) {
        const error = new Error("Path is outside allowed OpenClaw system-sense roots.");
        error.code = "PATH_OUTSIDE_ALLOWED_ROOTS";
        throw error;
      }
      return { path: resolved, root: "/workspace" };
    },
    getUid: () => 1000,
    ...overrides,
  });
}

test("system command operations preserve dry-run risk classification", () => {
  const operations = createOperations();

  const low = operations.buildCommandDryRun({ command: "echo", args: ["ok"] });
  const high = operations.buildCommandDryRun({ command: "systemctl", args: ["restart", "openclaw"] });
  const medium = operations.buildCommandDryRun({ command: "curl", args: ["https://example.test"] });

  assert.equal(low.risk, "low");
  assert.equal(low.requiresApproval, false);
  assert.equal(high.risk, "high");
  assert.equal(high.requiresApproval, true);
  assert.equal(medium.risk, "medium");
  assert.equal(medium.requiresApproval, true);
});

test("system command operations enforce allowlist and root execution boundaries", async () => {
  const operations = createOperations();
  await assert.rejects(
    () => operations.executeCommand({ command: "/bin/echo", args: ["no"] }),
    (error) => error?.code === "COMMAND_PATH_NOT_ALLOWED",
  );
  await assert.rejects(
    () => operations.executeCommand({ command: "sh", args: ["-c", "echo no"] }),
    (error) => error?.code === "COMMAND_NOT_ALLOWLISTED",
  );

  const rootOperations = createOperations({ getUid: () => 0 });
  await assert.rejects(
    () => rootOperations.executeCommand({ command: "echo", args: ["no"] }),
    (error) => error?.code === "ROOT_EXECUTION_REFUSED",
  );
});

test("system command operations execute injected allowlisted commands with bounded output", async () => {
  const operations = createOperations({
    execFileImpl: (command, args, options, callback) => {
      callback(null, "abcdef", "");
    },
  });

  const execution = await operations.executeCommand({
    command: "echo",
    args: ["abcdef"],
    cwd: "/workspace/project",
    timeoutMs: 1000,
  });

  assert.equal(execution.command, "echo");
  assert.deepEqual(execution.args, ["abcdef"]);
  assert.equal(execution.cwd, "/workspace/project");
  assert.equal(execution.timeoutMs, 500);
  assert.equal(execution.result.stdout, "abcde");
  assert.equal(execution.result.stdoutTruncated, true);
  assert.equal(execution.result.exitCode, 0);
});
