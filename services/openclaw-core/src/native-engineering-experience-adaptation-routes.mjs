import { readJsonBody, sendJson } from "../../../packages/shared-utils/src/http.mjs";

const BASE_PATH = "/plugins/native-adapter/engineering-context/experience-adaptation";
const EXPERIMENTS_PATH = `${BASE_PATH}/experiments`;
const ACTIVATE_PATH = `${BASE_PATH}/profiles/activate`;

function assertExactKeys(body, allowed) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Experience adaptation request body must be an object.");
  }
  const unexpected = Object.keys(body).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new Error(`Experience adaptation does not accept field: ${unexpected[0]}.`);
  }
}

async function publishChange(publishEvent, action, result) {
  const isProfile = result?.registry === "nixsoma-experience-ranking-profile-v0";
  try {
    await publishEvent?.("experience.adaptation_changed", {
      registry: "nixsoma-controlled-experience-adaptation-v0",
      action,
      experimentId: isProfile ? result?.sourceExperimentId ?? null : result?.id ?? null,
      profileId: isProfile ? result?.id ?? null : result?.activatedProfileId ?? null,
      taskType: result?.taskType ?? null,
      status: result?.status ?? null,
      rankingMode: result?.rankingMode ?? result?.analysis?.candidateRankingMode ?? null,
      contentIncluded: false,
      changesExecutionPolicy: false,
      changesAuthority: false,
    });
  } catch {
    // Durable Core state is the authority; Event Hub projection is best effort.
  }
}

export async function handleNativeEngineeringExperienceAdaptationRoute({
  req,
  res,
  requestUrl,
  experienceAdaptation,
  publishEvent,
}) {
  if (!requestUrl.pathname.startsWith(BASE_PATH)) return false;
  if (!experienceAdaptation) {
    sendJson(res, 503, { ok: false, error: "Experience adaptation owner is unavailable." });
    return true;
  }

  try {
    if (requestUrl.pathname === BASE_PATH) {
      if (req.method !== "GET") {
        sendJson(res, 405, { ok: false, error: "Method not allowed." });
        return true;
      }
      sendJson(res, 200, experienceAdaptation.readModel({
        taskType: requestUrl.searchParams.get("taskType") ?? null,
      }));
      return true;
    }

    if (requestUrl.pathname === EXPERIMENTS_PATH) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: "Method not allowed." });
        return true;
      }
      const body = await readJsonBody(req);
      assertExactKeys(body, new Set(["confirm", "taskType", "trialLimit", "durationMinutes"]));
      const experiment = experienceAdaptation.arm(body);
      await publishChange(publishEvent, "experiment_armed", experiment);
      sendJson(res, 201, { ok: true, experiment });
      return true;
    }

    const experimentAction = requestUrl.pathname.match(
      /^\/plugins\/native-adapter\/engineering-context\/experience-adaptation\/experiments\/([^/]+)\/(rearm|cancel)$/u,
    );
    if (experimentAction) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: "Method not allowed." });
        return true;
      }
      const body = await readJsonBody(req);
      assertExactKeys(body, new Set(["confirm"]));
      const experimentId = decodeURIComponent(experimentAction[1]);
      const action = experimentAction[2];
      const experiment = action === "rearm"
        ? experienceAdaptation.rearm(experimentId, body)
        : experienceAdaptation.cancel(experimentId, body);
      await publishChange(publishEvent, `experiment_${action === "rearm" ? "rearmed" : "cancelled"}`, experiment);
      sendJson(res, 200, { ok: true, experiment });
      return true;
    }

    if (requestUrl.pathname === ACTIVATE_PATH) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: "Method not allowed." });
        return true;
      }
      const body = await readJsonBody(req);
      assertExactKeys(body, new Set(["confirm", "experimentId", "evidenceHash"]));
      const profile = experienceAdaptation.activateProfile(body);
      await publishChange(publishEvent, "profile_activated", profile);
      sendJson(res, 201, { ok: true, profile });
      return true;
    }

    const revokeAction = requestUrl.pathname.match(
      /^\/plugins\/native-adapter\/engineering-context\/experience-adaptation\/profiles\/([^/]+)\/revoke$/u,
    );
    if (revokeAction) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: "Method not allowed." });
        return true;
      }
      const body = await readJsonBody(req);
      assertExactKeys(body, new Set(["confirm"]));
      const profile = experienceAdaptation.revokeProfile(decodeURIComponent(revokeAction[1]), body);
      await publishChange(publishEvent, "profile_revoked", profile);
      sendJson(res, 200, { ok: true, profile });
      return true;
    }

    sendJson(res, 404, { ok: false, error: "Experience adaptation route not found." });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
  return true;
}
