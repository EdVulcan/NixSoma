import { readJsonBody, sendJson } from "../../../packages/shared-utils/src/http.mjs";

function missionIdFromPath(pathname, action) {
  const prefix = "/operator/mission/";
  const suffix = `/${action}`;
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null;
  const id = pathname.slice(prefix.length, -suffix.length);
  return id && !id.includes("/") ? id : null;
}

function missionEnvelope(supervisor, mission = null) {
  return {
    ok: true,
    supervisor: supervisor.state(),
    mission,
    missions: supervisor.listPublic(),
  };
}

function unavailable(res) {
  sendJson(res, 503, { ok: false, error: "Renewable operator missions are unavailable." });
}

function invalid(res, error, fallback) {
  sendJson(res, 400, {
    ok: false,
    error: error instanceof Error ? error.message : fallback,
  });
}

export async function handleOperatorMissionRoute({
  req,
  res,
  requestUrl,
  renewableOperatorMissionSupervisor = null,
}) {
  const supervisor = renewableOperatorMissionSupervisor;

  if (requestUrl.pathname === "/operator/mission") {
    if (!supervisor) {
      unavailable(res);
      return true;
    }
    if (req.method === "GET") {
      sendJson(res, 200, missionEnvelope(supervisor));
      return true;
    }
    if (req.method === "POST") {
      try {
        const mission = supervisor.arm(await readJsonBody(req));
        sendJson(res, 201, missionEnvelope(supervisor, mission));
      } catch (error) {
        invalid(res, error, "Invalid renewable mission request.");
      }
      return true;
    }
    sendJson(res, 405, { ok: false, error: "Method not allowed." });
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/operator/mission/tick") {
    if (!supervisor) {
      unavailable(res);
      return true;
    }
    const result = await supervisor.tick();
    sendJson(res, result.ok === false ? 409 : 200, result);
    return true;
  }

  for (const action of ["renew", "pause", "rearm", "cancel"]) {
    const missionId = missionIdFromPath(requestUrl.pathname, action);
    if (req.method !== "POST" || !missionId) continue;
    if (!supervisor) {
      unavailable(res);
      return true;
    }
    try {
      const body = await readJsonBody(req);
      const mission = action === "renew"
        ? supervisor.renew(missionId, body)
        : action === "rearm"
          ? supervisor.rearm(missionId, body)
          : supervisor[action](missionId, body.confirm === true);
      sendJson(res, 200, missionEnvelope(supervisor, mission));
    } catch (error) {
      invalid(res, error, `Invalid mission ${action} request.`);
    }
    return true;
  }

  return false;
}
