import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { validateNativeDeclarativeEvolutionNixFile } from "./native-declarative-evolution-builders.mjs";
import { resolveNativeDeclarativeEvolutionStagingDirectory } from "./native-declarative-evolution-paths.mjs";

const execFileAsync = promisify(execFile);
const MAX_COMMAND_OUTPUT = 512;
const DEFAULT_TIMEOUT_MS = 600000;

function assertCandidateHash(candidateHash) {
  if (!/^[a-f0-9]{64}$/.test(candidateHash)) {
    throw new Error("Declarative evolution candidate hash must be a sha256 hex digest.");
  }
  return candidateHash;
}

function hashCandidate(candidateText) {
  return createHash("sha256").update(candidateText, "utf8").digest("hex");
}

function boundedOutputBytes(value) {
  return typeof value === "string" ? Math.min(Buffer.byteLength(value, "utf8"), MAX_COMMAND_OUTPUT) : 0;
}

function nixPathLiteral(value) {
  return `(builtins.toPath ${JSON.stringify(path.resolve(value))})`;
}

function buildNixOsExpression({ flakePath, baseModulePath, stagedPath, system, body }) {
  return [
    `let flake = builtins.getFlake ${JSON.stringify(flakePath)};`,
    `candidate = ${nixPathLiteral(stagedPath)};`,
    `base = ${nixPathLiteral(baseModulePath)};`,
    `system = flake.inputs.nixpkgs.lib.nixosSystem { system = ${JSON.stringify(system)}; modules = [ base candidate { fileSystems."/" = { device = "none"; fsType = "tmpfs"; }; boot.loader.grub.devices = [ "nodev" ]; } ]; };`,
    `in ${body}`,
  ].join(" ");
}

async function defaultRunNixCommand(nixCommand, args, { timeoutMs }) {
  try {
    const { stdout, stderr } = await execFileAsync(nixCommand, args, {
      timeout: timeoutMs,
      maxBuffer: 32 * 1024,
    });
    return {
      status: "passed",
      stdout,
      stderrBytes: boundedOutputBytes(stderr),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { status: "unavailable", reason: "nix_command_unavailable" };
    }
    return {
      status: "failed",
      reason: error?.killed ? "nix_command_timeout" : "nix_command_failed",
      exitCode: Number.isInteger(error?.status) ? error.status : null,
      stderrBytes: boundedOutputBytes(error?.stderr),
    };
  }
}

function buildNixCommandArgs(command, expression, { buildMode }) {
  const args = [
    "--extra-experimental-features",
    "nix-command flakes",
    command,
    "--impure",
  ];
  if (command === "build") {
    args.push("--option", "max-jobs", "1", "--option", "cores", "1");
    args.push("--no-link");
    args.push("--print-out-paths");
    if (buildMode === "dry-run") {
      args.push("--dry-run");
    }
  } else {
    args.push("--json");
  }
  args.push("--expr", expression);
  return args;
}

export function createNativeDeclarativeEvolutionExecution({
  stagingDir = process.env.OPENCLAW_MANAGED_CONFIG_STAGING_DIR
    ?? path.join(process.env.OPENCLAW_BODY_STATE_DIR ?? path.resolve(process.cwd(), "../../.artifacts"), "managed-config-staging"),
  flakePath = process.env.OPENCLAW_NIXOS_FLAKE ?? null,
  baseModulePath = process.env.OPENCLAW_NIXOS_BASE_MODULE ?? null,
  system = process.env.OPENCLAW_NIX_SYSTEM ?? "x86_64-linux",
  nixCommand = process.env.OPENCLAW_NIX_COMMAND ?? "nix",
  nixInstantiate = process.env.OPENCLAW_NIX_INSTANTIATE ?? "nix-instantiate",
  buildMode = process.env.OPENCLAW_NIXOS_BUILD_MODE ?? "build",
  timeoutMs = Number.parseInt(process.env.OPENCLAW_NIXOS_BUILD_TIMEOUT_MS ?? `${DEFAULT_TIMEOUT_MS}`, 10),
  validateCandidateFile = validateNativeDeclarativeEvolutionNixFile,
  runNixCommand = (args, options) => defaultRunNixCommand(nixCommand, args, options),
  mkdirImpl = mkdir,
  readFileImpl = readFile,
  writeFileImpl = writeFile,
} = {}) {
  const resolvedStagingDir = resolveNativeDeclarativeEvolutionStagingDirectory({ stagingDir });
  const resolvedFlakePath = flakePath ? path.resolve(flakePath) : null;
  const resolvedBaseModulePath = baseModulePath
    ? path.resolve(baseModulePath)
    : resolvedFlakePath
      ? path.join(resolvedFlakePath, "nix/hosts/local-dev.nix")
      : null;
  const safeTimeoutMs = Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const safeBuildMode = buildMode === "dry-run" ? "dry-run" : "build";

  function stagedCandidatePath(candidateHash) {
    return path.join(resolvedStagingDir, `openclaw-managed-${assertCandidateHash(candidateHash)}.nix`);
  }

  async function stageCandidate({ candidateText, candidateHash }) {
    if (typeof candidateText !== "string" || candidateText.length === 0) {
      throw new Error("Declarative evolution staging requires candidate text.");
    }
    const expectedHash = assertCandidateHash(candidateHash);
    const actualHash = hashCandidate(candidateText);
    if (actualHash !== expectedHash) {
      throw new Error("Declarative evolution candidate hash does not match candidate text.");
    }

    await mkdirImpl(resolvedStagingDir, { recursive: true, mode: 0o750 });
    const candidatePath = stagedCandidatePath(expectedHash);
    try {
      await writeFileImpl(candidatePath, candidateText, {
        encoding: "utf8",
        mode: 0o640,
        flag: "wx",
      });
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }
      const existingText = await readFileImpl(candidatePath, { encoding: "utf8" });
      if (hashCandidate(existingText) !== expectedHash) {
        throw new Error("Existing declarative evolution staging file failed hash verification.");
      }
    }

    return {
      status: "staged",
      directory: resolvedStagingDir,
      path: candidatePath,
      candidateHash: expectedHash,
      candidateBytes: Buffer.byteLength(candidateText, "utf8"),
    };
  }

  async function runReadOnlyNixOsCheck({ candidateHash, candidatePath }) {
    const expectedHash = assertCandidateHash(candidateHash);
    const validation = await validateCandidateFile(candidatePath, {
      nixInstantiate,
      timeoutMs: Math.min(safeTimeoutMs, 10000),
    });
    if (validation?.status !== "passed") {
      return {
        status: "blocked",
        reason: "staged_candidate_validation_failed",
        candidateHash: expectedHash,
        validation: {
          status: validation?.status ?? "unavailable",
          mode: validation?.mode ?? "nix-instantiate",
          reason: validation?.reason ?? null,
        },
        evaluation: null,
        build: null,
      };
    }

    if (!resolvedFlakePath || !resolvedBaseModulePath) {
      return {
        status: "blocked",
        reason: "nixos_flake_unconfigured",
        candidateHash: expectedHash,
        validation: { status: "passed", mode: validation.mode },
        evaluation: null,
        build: null,
      };
    }

    const evaluationExpression = buildNixOsExpression({
      flakePath: resolvedFlakePath,
      baseModulePath: resolvedBaseModulePath,
      stagedPath: candidatePath,
      system,
      body: "{ candidateType = builtins.typeOf (import candidate); components = system.config.services.openclaw.components; toplevelPath = builtins.toString system.config.system.build.toplevel; toplevelEvaluated = builtins.isString (builtins.toString system.config.system.build.toplevel); }",
    });
    const evaluationResult = await runNixCommand(
      buildNixCommandArgs("eval", evaluationExpression, { buildMode: safeBuildMode }),
      { timeoutMs: safeTimeoutMs },
    );
    if (evaluationResult?.status !== "passed") {
      return {
        status: "blocked",
        reason: "nixos_evaluation_failed",
        candidateHash: expectedHash,
        validation: { status: "passed", mode: validation.mode },
        evaluation: {
          status: evaluationResult?.status ?? "failed",
          reason: evaluationResult?.reason ?? null,
          exitCode: evaluationResult?.exitCode ?? null,
        },
        build: null,
      };
    }

    let evaluation = null;
    try {
      const parsed = JSON.parse(String(evaluationResult.stdout ?? "").trim());
      evaluation = {
        status: parsed?.candidateType === "lambda"
          && parsed?.toplevelEvaluated === true
          && typeof parsed?.toplevelPath === "string"
          && parsed.toplevelPath.startsWith("/nix/store/")
          ? "passed"
          : "failed",
        mode: "nix-eval",
        candidateType: parsed?.candidateType ?? null,
        componentCount: Array.isArray(parsed?.components) ? parsed.components.length : 0,
        toplevelPath: parsed?.toplevelPath ?? null,
        toplevelEvaluated: parsed?.toplevelEvaluated === true,
      };
    } catch {
      evaluation = {
        status: "failed",
        mode: "nix-eval",
        reason: "invalid_nix_eval_result",
      };
    }
    if (evaluation.status !== "passed") {
      return {
        status: "blocked",
        reason: "nixos_evaluation_result_invalid",
        candidateHash: expectedHash,
        validation: { status: "passed", mode: validation.mode },
        evaluation,
        build: null,
      };
    }

    const buildExpression = buildNixOsExpression({
      flakePath: resolvedFlakePath,
      baseModulePath: resolvedBaseModulePath,
      stagedPath: candidatePath,
      system,
      body: "system.config.system.build.toplevel",
    });
    const buildResult = await runNixCommand(
      buildNixCommandArgs("build", buildExpression, { buildMode: safeBuildMode }),
      { timeoutMs: safeTimeoutMs },
    );
    const build = {
      status: buildResult?.status ?? "failed",
      mode: safeBuildMode === "dry-run" ? "nix-build-dry-run" : "nix-build-no-link",
      outputPath: String(buildResult?.stdout ?? "")
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .find((line) => /^\/nix\/store\/[a-z0-9][a-z0-9+._?=-]*$/u.test(line)) ?? null,
      reason: buildResult?.reason ?? null,
      exitCode: buildResult?.exitCode ?? null,
    };
    return {
      status: build.status === "passed" ? "passed" : "blocked",
      reason: build.status === "passed" ? null : "nixos_build_failed",
      candidateHash: expectedHash,
      validation: { status: "passed", mode: validation.mode },
      evaluation,
      build,
    };
  }

  async function executeNativeDeclarativeEvolutionCandidate({ candidateText, candidateHash }) {
    const staging = await stageCandidate({ candidateText, candidateHash });
    const check = await runReadOnlyNixOsCheck({
      candidateHash: staging.candidateHash,
      candidatePath: staging.path,
    });
    return {
      ...check,
      staging,
      governance: {
        writesManagedConfig: false,
        writesOpenClawStaging: true,
        runsNixEvaluation: check.evaluation?.status === "passed",
        runsNixBuild: check.build?.status === "passed",
        switchesGeneration: false,
        executesRollback: false,
        healthGate: false,
        providerEgress: false,
        networkEgress: false,
      },
    };
  }

  return {
    stagingDirectory: resolvedStagingDir,
    stagingPath: stagedCandidatePath,
    stageCandidate,
    runReadOnlyNixOsCheck,
    executeNativeDeclarativeEvolutionCandidate,
  };
}
