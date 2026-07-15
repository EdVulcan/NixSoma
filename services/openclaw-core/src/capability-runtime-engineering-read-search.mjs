const READ_CAPABILITY_ID = "sense.openclaw.engineering_tool.read";
const GLOB_CAPABILITY_ID = "sense.openclaw.engineering_tool.glob";
const GREP_CAPABILITY_ID = "sense.openclaw.engineering_tool.grep";

function requireBuilder(builder, name) {
  if (typeof builder !== "function") {
    throw new Error(`${name} is not configured.`);
  }
  return builder;
}

export function createEngineeringReadSearchCapabilityHandlers({
  buildNativeEngineeringReadFile,
  buildNativeEngineeringGlob,
  buildNativeEngineeringGrep,
} = {}) {
  function callBackend(capability, request) {
    if (capability.id === READ_CAPABILITY_ID) {
      return {
        handled: true,
        result: requireBuilder(buildNativeEngineeringReadFile, "buildNativeEngineeringReadFile")({
          workspacePath: request.params.workspacePath,
          relativePath: request.params.relativePath ?? request.params.path,
          startLine: request.params.startLine ?? request.params.start_line,
          endLine: request.params.endLine ?? request.params.end_line,
          maxOutputChars: request.params.maxOutputChars,
          maxFileSizeBytes: request.params.maxFileSizeBytes,
        }),
      };
    }

    if (capability.id === GLOB_CAPABILITY_ID) {
      return {
        handled: true,
        result: requireBuilder(buildNativeEngineeringGlob, "buildNativeEngineeringGlob")({
          workspacePath: request.params.workspacePath,
          pattern: request.params.pattern,
          limit: request.params.limit,
        }),
      };
    }

    if (capability.id === GREP_CAPABILITY_ID) {
      return {
        handled: true,
        result: requireBuilder(buildNativeEngineeringGrep, "buildNativeEngineeringGrep")({
          workspacePath: request.params.workspacePath,
          query: request.params.query ?? request.params.q,
          literal: request.params.literal,
          caseSensitive: request.params.caseSensitive ?? request.params.case_sensitive,
          include: request.params.include,
          limit: request.params.limit,
          maxOutputChars: request.params.maxOutputChars,
          maxFileSizeBytes: request.params.maxFileSizeBytes,
        }),
      };
    }

    return { handled: false, result: null };
  }

  function summariseResult(capability, result) {
    if (capability.id === READ_CAPABILITY_ID) {
      return {
        kind: "engineering.read",
        ok: result?.ok === true,
        blocked: result?.blocked === true,
        path: result?.target?.relativePath ?? null,
        lineCount: result?.summary?.lineCount ?? 0,
        charsReturned: result?.summary?.charsReturned ?? 0,
        outputTruncated: result?.summary?.outputTruncated === true,
        contentExposed: result?.target?.contentExposed === true,
      };
    }

    if (capability.id === GLOB_CAPABILITY_ID) {
      return {
        kind: "engineering.glob",
        ok: result?.ok === true,
        pattern: result?.summary?.pattern ?? result?.query?.pattern ?? null,
        matchedResults: result?.summary?.matchedResults ?? 0,
        resultsTruncated: result?.summary?.resultsTruncated === true,
        filesConsidered: result?.summary?.filesConsidered ?? 0,
        contentRead: result?.summary?.contentRead === true,
      };
    }

    if (capability.id === GREP_CAPABILITY_ID) {
      return {
        kind: "engineering.grep",
        ok: result?.ok === true,
        query: result?.summary?.query ?? result?.query?.text ?? null,
        include: result?.summary?.include ?? result?.query?.include ?? null,
        matchedResults: result?.summary?.matchedResults ?? 0,
        outputChars: result?.summary?.outputChars ?? 0,
        resultsTruncated: result?.summary?.resultsTruncated === true,
        filesRead: result?.summary?.filesRead ?? 0,
      };
    }

    return null;
  }

  return {
    callBackend,
    summariseResult,
  };
}
