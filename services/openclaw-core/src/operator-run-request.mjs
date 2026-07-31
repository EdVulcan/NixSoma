export const OPERATOR_RUN_REQUEST_REGISTRY = "nixsoma-bounded-operator-run-request-v0";

const ALLOWED_FIELDS = new Set(["maxSteps", "dryRun"]);
export const OPERATOR_RUN_MAXIMUM_STEPS = 20;

function fail(message) {
  throw new Error(`Bounded operator run ${message}.`);
}

export function buildBoundedOperatorRunRequest(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail("requires an object body");
  }
  if (Object.keys(body).some((field) => !ALLOWED_FIELDS.has(field))) {
    fail("does not accept task execution override fields");
  }
  if (!Number.isInteger(body.maxSteps)
    || body.maxSteps < 1
    || body.maxSteps > OPERATOR_RUN_MAXIMUM_STEPS) {
    fail(`requires maxSteps between 1 and ${OPERATOR_RUN_MAXIMUM_STEPS}`);
  }
  if (body.dryRun !== undefined && typeof body.dryRun !== "boolean") {
    fail("requires dryRun to be boolean");
  }

  const dryRun = body.dryRun === true;
  return {
    request: {
      maxSteps: body.maxSteps,
      dryRun,
    },
    session: {
      registry: OPERATOR_RUN_REQUEST_REGISTRY,
      status: dryRun ? "previewed" : "run_requested",
      maximumSteps: body.maxSteps,
      dryRun,
      governance: {
        explicitOperatorTrigger: true,
        taskOverridesAccepted: false,
        backgroundScheduling: false,
        automaticRepeat: false,
        automaticRetry: false,
        openLoop: false,
        createsTask: false,
        createsApproval: false,
        callsProvider: false,
        mutatesHost: false,
      },
    },
  };
}
