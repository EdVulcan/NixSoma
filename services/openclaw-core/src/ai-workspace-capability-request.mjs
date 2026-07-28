const ALLOWED_BODY_KEYS = new Set(["capabilityId", "taskId", "params"]);
const ALLOWED_PARAM_KEYS = new Set(["confirm"]);
const MAX_TASK_ID_CHARS = 200;

export function aiWorkspaceTaskRequestIsBounded(request, rawBody) {
  const taskId = typeof request?.taskId === "string" ? request.taskId.trim() : "";
  if (request?.params?.confirm !== true
    || !taskId
    || taskId.length > MAX_TASK_ID_CHARS
    || request.stepId !== null
    || request.operation !== null
    || request.intent !== null
    || Object.keys(request.params ?? {}).some((key) => !ALLOWED_PARAM_KEYS.has(key))) {
    return false;
  }
  return rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
    && Object.keys(rawBody).every((key) => ALLOWED_BODY_KEYS.has(key));
}
