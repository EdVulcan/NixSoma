import { createAiFixedApplicationLifecycleRoute } from "./ai-fixed-application-lifecycle-route.mjs";

const OPERATOR_ACTION_SOURCES = ["capability_runtime_work_view_control"];

export function createAiWorkbenchLifecycleRoute(dependencies = {}) {
  return createAiFixedApplicationLifecycleRoute({
    ...dependencies,
    definition: {
      registry: "nixsoma-ai-workbench-lifecycle-v0",
      unitName: "nixsoma-ai-workbench.service",
      label: "AI workbench",
      errorCodePrefix: "AI_WORKBENCH",
      eventActionPrefix: "ai-workbench",
    },
    routes: [
      {
        path: "/work-view/application/start",
        operation: "start",
        auditAction: "ai-workbench-start-requested",
        expectedRecommendation: "start_ai_workbench",
        operatorActionSources: OPERATOR_ACTION_SOURCES,
      },
      {
        path: "/work-view/application/stop",
        operation: "stop",
        auditAction: "ai-workbench-stop-requested",
        expectedRecommendation: "stop_ai_workbench",
        operatorActionSources: OPERATOR_ACTION_SOURCES,
      },
    ],
  });
}
