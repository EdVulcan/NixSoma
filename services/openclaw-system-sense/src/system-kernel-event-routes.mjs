import { sendJson } from "../../../packages/shared-utils/src/http.mjs";

const KERNEL_EVENT_GET_ROUTES = new Map([
  ["/system/kernel/process-exec-events", "buildKernelProcessExecEvents"],
]);

export async function handleSystemKernelEventRoutes({ req, res, requestUrl, builders }) {
  if (req.method !== "GET") {
    return false;
  }

  const builderName = KERNEL_EVENT_GET_ROUTES.get(requestUrl.pathname);
  if (!builderName) {
    return false;
  }

  const payload = await builders[builderName]();
  sendJson(res, 200, payload);
  return true;
}
