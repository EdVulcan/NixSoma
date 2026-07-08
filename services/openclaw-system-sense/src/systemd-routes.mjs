import { sendJson } from "../../../packages/shared-utils/src/http.mjs";

const SYSTEMD_GET_ROUTES = new Map([
  ["/system/systemd/units", "buildSystemdUnitInventory"],
  ["/system/systemd/dependency-map", "buildSystemdDependencyMap"],
  ["/system/systemd/repair-candidates", "buildSystemdRepairCandidateAssessment"],
  ["/system/systemd/repair-candidate-plan", "buildSystemdRepairCandidatePlan"],
  ["/system/systemd/repair-candidate-task-route", "buildSystemdRepairCandidateTaskRoute"],
  ["/system/systemd/repair-candidate-readiness", "buildSystemdRepairCandidateReadiness"],
  ["/system/systemd/repair-candidate-route-review", "buildSystemdRepairCandidateRouteReview"],
  ["/system/systemd/repair-candidate-demo-status", "buildSystemdRepairCandidateDemoStatus"],
  ["/system/systemd/next-repair-scope-review", "buildSystemdNextRepairScopeReview"],
  ["/system/systemd/next-repair-plan", "buildSystemdNextRepairPlan"],
  ["/system/systemd/next-repair-route-review", "buildSystemdNextRepairRouteReview"],
  ["/system/systemd/next-repair-dry-run", "buildSystemdNextRepairDryRun"],
  ["/system/systemd/next-repair-task-route", "buildSystemdNextRepairTaskRoute"],
]);

function sendSystemdError(res, error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  sendJson(res, 400, {
    ok: false,
    error: message,
    code: error.code ?? null,
    details: error.details ?? null,
  });
}

function buildRepairRequest(requestUrl) {
  return {
    unit: requestUrl.searchParams.get("unit") ?? requestUrl.searchParams.get("target"),
    reason: requestUrl.searchParams.get("reason"),
  };
}

export async function handleSystemdRoutes({ req, res, requestUrl, builders }) {
  if (req.method !== "GET") {
    return false;
  }

  const builderName = SYSTEMD_GET_ROUTES.get(requestUrl.pathname);
  if (builderName) {
    const payload = await builders[builderName]();
    sendJson(res, 200, payload);
    return true;
  }

  if (requestUrl.pathname === "/system/systemd/repair-plan") {
    try {
      const plan = await builders.buildSystemdRepairPlan(buildRepairRequest(requestUrl));
      sendJson(res, 200, plan);
    } catch (error) {
      sendSystemdError(res, error);
    }
    return true;
  }

  if (requestUrl.pathname === "/system/systemd/repair-dry-run") {
    try {
      const envelope = await builders.buildSystemdRepairDryRun(buildRepairRequest(requestUrl));
      sendJson(res, 200, envelope);
    } catch (error) {
      sendSystemdError(res, error);
    }
    return true;
  }

  return false;
}
