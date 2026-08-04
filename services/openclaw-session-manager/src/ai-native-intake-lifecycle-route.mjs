import { createAiFixedApplicationLifecycleRoute } from "./ai-fixed-application-lifecycle-route.mjs";

const OPERATOR_ACTION_SOURCES = [
  "capability_runtime_work_view_control",
  "ai_workspace_native_intake_workflow",
];

export function createAiNativeIntakeLifecycleRoute(dependencies = {}) {
  return createAiFixedApplicationLifecycleRoute({
    ...dependencies,
    definition: {
      registry: "nixsoma-ai-native-intake-lifecycle-v0",
      unitName: "nixsoma-ai-native-intake.service",
      label: "AI native intake",
      errorCodePrefix: "AI_NATIVE_INTAKE",
      eventActionPrefix: "ai-native-intake",
    },
    routes: [
      {
        path: "/work-view/application/native-intake/start",
        operation: "start",
        auditAction: "ai-native-intake-start-requested",
        expectedRecommendation: "start_ai_native_intake",
        operatorActionSources: OPERATOR_ACTION_SOURCES,
      },
      {
        path: "/work-view/application/native-intake/stop",
        operation: "stop",
        auditAction: "ai-native-intake-stop-requested",
        expectedRecommendation: "stop_ai_native_intake",
        operatorActionSources: OPERATOR_ACTION_SOURCES,
      },
    ],
  });
}
