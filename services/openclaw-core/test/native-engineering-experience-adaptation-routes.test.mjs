import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import {
  handleNativeEngineeringExperienceAdaptationRoute,
} from "../src/native-engineering-experience-adaptation-routes.mjs";

async function invoke(owner, method, path, body = {}, publishEvent = async () => {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = method;
  const response = { statusCode: null, body: null };
  const res = {
    writeHead(statusCode) { response.statusCode = statusCode; },
    end(payload) { response.body = JSON.parse(String(payload)); },
  };
  const handled = await handleNativeEngineeringExperienceAdaptationRoute({
    req,
    res,
    requestUrl: new URL(`http://127.0.0.1${path}`),
    experienceAdaptation: owner,
    publishEvent,
  });
  return { handled, ...response };
}

function owner(calls) {
  return {
    readModel: (input) => ({
      ok: true,
      registry: "nixsoma-controlled-experience-adaptation-v0",
      filter: input,
      experiments: [],
      profiles: [],
    }),
    arm: (input) => {
      calls.push({ action: "arm", input });
      return { id: "experiment-1", taskType: input.taskType, status: "armed" };
    },
    rearm: (id, input) => {
      calls.push({ action: "rearm", id, input });
      return { id, taskType: "browser_task", status: "armed" };
    },
    cancel: (id, input) => {
      calls.push({ action: "cancel", id, input });
      return { id, taskType: "browser_task", status: "cancelled" };
    },
    activateProfile: (input) => {
      calls.push({ action: "activate", input });
      return {
        id: "experience-profile-1",
        sourceExperimentId: input.experimentId,
        taskType: "browser_task",
        rankingMode: "feedback_weighted",
      };
    },
    revokeProfile: (taskType, input) => {
      calls.push({ action: "revoke", taskType, input });
      return { id: "experience-profile-1", taskType, rankingMode: "feedback_weighted", status: "revoked" };
    },
  };
}

test("experience adaptation routes expose only finite explicit controls", async () => {
  const calls = [];
  const events = [];
  const adaptation = owner(calls);
  const publishEvent = async (name, payload) => events.push({ name, payload });

  const state = await invoke(
    adaptation,
    "GET",
    "/plugins/native-adapter/engineering-context/experience-adaptation?taskType=browser_task",
    {},
    publishEvent,
  );
  assert.equal(state.statusCode, 200);
  assert.equal(state.body.filter.taskType, "browser_task");
  assert.equal((await invoke(
    adaptation,
    "POST",
    "/plugins/native-adapter/engineering-context/experience-adaptation/experiments",
    { confirm: true, taskType: "browser_task", trialLimit: 8, durationMinutes: 60 },
    publishEvent,
  )).statusCode, 201);
  assert.equal((await invoke(
    adaptation,
    "POST",
    "/plugins/native-adapter/engineering-context/experience-adaptation/experiments/experiment-1/rearm",
    { confirm: true },
    publishEvent,
  )).statusCode, 200);
  assert.equal((await invoke(
    adaptation,
    "POST",
    "/plugins/native-adapter/engineering-context/experience-adaptation/experiments/experiment-1/cancel",
    { confirm: true },
    publishEvent,
  )).statusCode, 200);
  assert.equal((await invoke(
    adaptation,
    "POST",
    "/plugins/native-adapter/engineering-context/experience-adaptation/profiles/activate",
    { confirm: true, experimentId: "experiment-1", evidenceHash: "a".repeat(64) },
    publishEvent,
  )).statusCode, 201);
  assert.equal((await invoke(
    adaptation,
    "POST",
    "/plugins/native-adapter/engineering-context/experience-adaptation/profiles/browser_task/revoke",
    { confirm: true },
    publishEvent,
  )).statusCode, 200);

  assert.deepEqual(calls.map(({ action }) => action), ["arm", "rearm", "cancel", "activate", "revoke"]);
  assert.equal(events.length, 5);
  assert.equal(events.every(({ name }) => name === "experience.adaptation_changed"), true);
  assert.equal(events.every(({ payload }) => payload.contentIncluded === false), true);
});

test("experience adaptation routes reject caller-selected experiment fields", async () => {
  const calls = [];
  const response = await invoke(
    owner(calls),
    "POST",
    "/plugins/native-adapter/engineering-context/experience-adaptation/experiments",
    {
      confirm: true,
      taskType: "browser_task",
      trialLimit: 8,
      durationMinutes: 60,
      rankingMode: "feedback_weighted",
    },
  );
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /does not accept field: rankingMode/u);
  assert.equal(calls.length, 0);
});
