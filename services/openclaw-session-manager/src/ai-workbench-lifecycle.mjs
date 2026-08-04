import {
  buildAiFixedApplicationLifecycleConfig,
  createAiFixedApplicationLifecycle,
} from "./ai-fixed-application-lifecycle.mjs";

export const AI_WORKBENCH_LIFECYCLE_REGISTRY =
  "nixsoma-ai-workbench-lifecycle-v0";

const DEFINITION = {
  registry: AI_WORKBENCH_LIFECYCLE_REGISTRY,
  expectedUnit: "nixsoma-ai-workbench.service",
  label: "AI workbench",
  errorCodePrefix: "AI_WORKBENCH",
};

export function buildAiWorkbenchLifecycleConfig({ env = process.env } = {}) {
  return buildAiFixedApplicationLifecycleConfig({
    env,
    expectedUnit: DEFINITION.expectedUnit,
    environmentPrefix: "OPENCLAW_AI_WORKBENCH",
  });
}

export function createAiWorkbenchLifecycle({ env = process.env, ...dependencies } = {}) {
  return createAiFixedApplicationLifecycle({
    definition: DEFINITION,
    config: buildAiWorkbenchLifecycleConfig({ env }),
    ...dependencies,
  });
}
