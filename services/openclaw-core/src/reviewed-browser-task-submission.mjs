export const REVIEWED_BROWSER_TASK_SUBMISSION_REGISTRY =
  "nixsoma-reviewed-browser-task-submission-v0";

const ALLOWED_FIELDS = new Set(["goal", "targetUrl", "includePlan"]);
const MAX_GOAL_CHARACTERS = 400;
const MAX_GOAL_BYTES = 1024;
const MAX_URL_CHARACTERS = 2048;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

function fail(message) {
  throw new Error(`Reviewed browser task submission ${message}.`);
}

function normaliseGoal(value) {
  const goal = typeof value === "string" ? value.trim() : "";
  const characterCount = [...goal].length;
  if (!goal
    || characterCount > MAX_GOAL_CHARACTERS
    || Buffer.byteLength(goal, "utf8") > MAX_GOAL_BYTES
    || CONTROL_CHARACTERS.test(goal)) {
    fail("requires a bounded single-line goal");
  }
  return { goal, characterCount };
}

function normaliseTargetUrl(value) {
  const input = typeof value === "string" ? value.trim() : "";
  if (!input || input.length > MAX_URL_CHARACTERS || CONTROL_CHARACTERS.test(input)) {
    fail("requires a bounded HTTP(S) target URL");
  }
  let target;
  try {
    target = new URL(input);
  } catch {
    fail("requires a valid HTTP(S) target URL");
  }
  if (!new Set(["http:", "https:"]).has(target.protocol)
    || target.username
    || target.password
    || !target.hostname) {
    fail("requires a credential-free HTTP(S) target URL");
  }
  return target.href;
}

export function buildReviewedBrowserTaskSubmission(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail("requires an object body");
  }
  if (Object.keys(body).some((field) => !ALLOWED_FIELDS.has(field))) {
    fail("does not accept execution authority fields");
  }
  if (body.includePlan !== undefined && typeof body.includePlan !== "boolean") {
    fail("requires includePlan to be boolean");
  }

  const { goal, characterCount } = normaliseGoal(body.goal);
  const targetUrl = normaliseTargetUrl(body.targetUrl);
  const includePlan = body.includePlan === true;
  return {
    taskInput: {
      goal,
      type: "browser_task",
      targetUrl,
      workViewStrategy: "ai-work-view",
      intent: "task.execute",
      includePlan,
      actions: [],
    },
    review: {
      registry: REVIEWED_BROWSER_TASK_SUBMISSION_REGISTRY,
      status: includePlan ? "reviewed_plan_created" : "reviewed_task_created",
      goalCharacterCount: characterCount,
      targetUrl,
      includePlan,
      governance: {
        explicitOperatorSubmission: true,
        fixedBrowserTask: true,
        fixedWorkViewStrategy: true,
        actionsAccepted: false,
        policyAccepted: false,
        createsApproval: false,
        startsExecution: false,
        callsProvider: false,
        automaticContinuation: false,
        mutatesHost: false,
      },
    },
  };
}
