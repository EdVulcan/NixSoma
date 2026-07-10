export class WorkViewAuthorityInterruptionError extends Error {
  constructor(stage, cause) {
    const causeMessage = cause instanceof Error ? cause.message : "work-view authority unavailable";
    super(`Work-view authority unavailable during ${stage}: ${causeMessage}`, { cause });
    this.name = "WorkViewAuthorityInterruptionError";
    this.code = "work_view_authority_interruption";
    this.stage = stage;
  }
}

export async function invokeWorkViewAuthority(stage, invoke) {
  try {
    return await invoke();
  } catch (error) {
    throw new WorkViewAuthorityInterruptionError(stage, error);
  }
}

export function isWorkViewAuthorityInterruption(error) {
  return error instanceof WorkViewAuthorityInterruptionError
    || error?.code === "work_view_authority_interruption";
}

export function serialiseWorkViewAuthorityInterruption(error) {
  if (!isWorkViewAuthorityInterruption(error)) {
    return null;
  }
  return {
    kind: "work-view-authority-interruption",
    code: "work_view_authority_interruption",
    stage: error.stage ?? "unknown",
    recoverable: true,
    automaticRestart: false,
    recoveryAction: "restore_trusted_work_view_then_recover_task",
  };
}
