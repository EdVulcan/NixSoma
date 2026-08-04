import {
  buildAiFixedApplicationLifecycleConfig,
  createAiFixedApplicationLifecycle,
} from "./ai-fixed-application-lifecycle.mjs";

export const AI_NATIVE_INTAKE_LIFECYCLE_REGISTRY =
  "nixsoma-ai-native-intake-lifecycle-v0";

const DEFINITION = {
  registry: AI_NATIVE_INTAKE_LIFECYCLE_REGISTRY,
  expectedUnit: "nixsoma-ai-native-intake.service",
  label: "AI native intake",
  errorCodePrefix: "AI_NATIVE_INTAKE",
  requireActivatedSurface: true,
};

export function buildAiNativeIntakeLifecycleConfig({ env = process.env } = {}) {
  return buildAiFixedApplicationLifecycleConfig({
    env,
    expectedUnit: DEFINITION.expectedUnit,
    environmentPrefix: "OPENCLAW_AI_NATIVE_INTAKE",
  });
}

export function createAiNativeIntakeLifecycle({ env = process.env, ...dependencies } = {}) {
  return createAiFixedApplicationLifecycle({
    definition: DEFINITION,
    config: buildAiNativeIntakeLifecycleConfig({ env }),
    ...dependencies,
  });
}
