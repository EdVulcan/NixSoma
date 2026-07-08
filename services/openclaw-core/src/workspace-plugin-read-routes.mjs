import { sendJson } from "../../../packages/shared-utils/src/http.mjs";

function errorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function packagePathParams(requestUrl) {
  return { packagePath: requestUrl.searchParams.get("packagePath") };
}

function manifestMapParams(requestUrl) {
  return {
    workspacePath: requestUrl.searchParams.get("workspacePath"),
    query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
    limit: requestUrl.searchParams.get("limit"),
  };
}

function sendHandledError(res, statusCode, error) {
  sendJson(res, statusCode, { ok: false, error: errorMessage(error) });
}

function safeRoute(handler, statusCode = 400) {
  return ({ res, ...context }) => {
    try {
      handler({ res, ...context });
    } catch (error) {
      sendHandledError(res, statusCode, error);
    }
  };
}

const WORKSPACE_PLUGIN_READ_ROUTES = new Map([
  [
    "/workspaces",
    ({ res, pluginReview }) => {
      sendJson(res, 200, {
        ok: true,
        ...pluginReview.buildWorkspaceRegistry(),
      });
    },
  ],
  [
    "/workspaces/summary",
    ({ res, pluginReview }) => {
      const registry = pluginReview.buildWorkspaceRegistry();
      sendJson(res, 200, {
        ok: true,
        registry: registry.registry,
        mode: registry.mode,
        generatedAt: registry.generatedAt,
        roots: registry.roots,
        summary: registry.summary,
      });
    },
  ],
  [
    "/workspaces/command-proposals",
    ({ res, pluginReview }) => {
      sendJson(res, 200, {
        ok: true,
        ...pluginReview.buildWorkspaceCommandProposals(),
      });
    },
  ],
  [
    "/workspaces/command-proposals/summary",
    ({ res, pluginReview }) => {
      const proposals = pluginReview.buildWorkspaceCommandProposals();
      sendJson(res, 200, {
        ok: true,
        registry: proposals.registry,
        mode: proposals.mode,
        generatedAt: proposals.generatedAt,
        roots: proposals.roots,
        summary: proposals.summary,
      });
    },
  ],
  [
    "/plugins/native-adapter/source-command-proposals",
    safeRoute(({ res, requestUrl, pluginReview }) => {
      sendJson(res, 200, {
        ok: true,
        ...pluginReview.buildOpenClawSourceCommandProposals({
          workspacePath: requestUrl.searchParams.get("workspacePath"),
          query: requestUrl.searchParams.get("query") ?? "command",
          limit: requestUrl.searchParams.get("limit") ?? "12",
        }),
      });
    }),
  ],
  [
    "/workspaces/openclaw-migration-map",
    ({ res, pluginReview }) => {
      sendJson(res, 200, {
        ok: true,
        ...pluginReview.buildOpenClawMigrationMap(),
      });
    },
  ],
  [
    "/workspaces/openclaw-migration-map/summary",
    ({ res, pluginReview }) => {
      const map = pluginReview.buildOpenClawMigrationMap();
      sendJson(res, 200, {
        ok: true,
        registry: map.registry,
        mode: map.mode,
        generatedAt: map.generatedAt,
        sourceRegistry: map.sourceRegistry,
        roots: map.roots,
        summary: map.summary,
      });
    },
  ],
  [
    "/workspaces/openclaw-migration-plan",
    ({ res, pluginReview }) => {
      sendJson(res, 200, {
        ok: true,
        ...pluginReview.buildOpenClawMigrationPlan(),
      });
    },
  ],
  [
    "/workspaces/openclaw-migration-plan/summary",
    ({ res, pluginReview }) => {
      const plan = pluginReview.buildOpenClawMigrationPlan();
      sendJson(res, 200, {
        ok: true,
        registry: plan.registry,
        mode: plan.mode,
        generatedAt: plan.generatedAt,
        sourceRegistry: plan.sourceRegistry,
        roots: plan.roots,
        summary: plan.summary,
      });
    },
  ],
  [
    "/workspaces/openclaw-plugin-sdk-contract-review",
    ({ res, pluginReview }) => {
      sendJson(res, 200, {
        ok: true,
        ...pluginReview.buildOpenClawPluginSdkContractReview(),
      });
    },
  ],
  [
    "/workspaces/openclaw-plugin-sdk-contract-review/summary",
    ({ res, pluginReview }) => {
      const review = pluginReview.buildOpenClawPluginSdkContractReview();
      sendJson(res, 200, {
        ok: true,
        registry: review.registry,
        mode: review.mode,
        generatedAt: review.generatedAt,
        sourceRegistry: review.sourceRegistry,
        roots: review.roots,
        summary: review.summary,
      });
    },
  ],
  [
    "/workspaces/openclaw-plugin-sdk-source-review-scope",
    safeRoute(({ res, requestUrl, pluginReview }) => {
      sendJson(res, 200, pluginReview.buildOpenClawPluginSdkSourceReviewScope(packagePathParams(requestUrl)));
    }),
  ],
  [
    "/workspaces/openclaw-plugin-sdk-source-review-scope/summary",
    safeRoute(({ res, requestUrl, pluginReview }) => {
      const scope = pluginReview.buildOpenClawPluginSdkSourceReviewScope(packagePathParams(requestUrl));
      sendJson(res, 200, {
        ok: true,
        registry: scope.registry,
        mode: scope.mode,
        generatedAt: scope.generatedAt,
        sourceRegistry: scope.sourceRegistry,
        sourceMode: scope.sourceMode,
        summary: scope.summary,
        governance: scope.governance,
      });
    }),
  ],
  [
    "/workspaces/openclaw-plugin-sdk-source-content-review",
    safeRoute(({ res, requestUrl, pluginReview }) => {
      sendJson(res, 200, pluginReview.buildOpenClawPluginSdkSourceContentReview(packagePathParams(requestUrl)));
    }),
  ],
  [
    "/workspaces/openclaw-plugin-sdk-source-content-review/summary",
    safeRoute(({ res, requestUrl, pluginReview }) => {
      const review = pluginReview.buildOpenClawPluginSdkSourceContentReview(packagePathParams(requestUrl));
      sendJson(res, 200, {
        ok: true,
        registry: review.registry,
        mode: review.mode,
        generatedAt: review.generatedAt,
        sourceRegistry: review.sourceRegistry,
        sourceMode: review.sourceMode,
        summary: review.summary,
        governance: review.governance,
      });
    }),
  ],
  [
    "/workspaces/openclaw-plugin-sdk-native-contract-tests",
    safeRoute(({ res, requestUrl, pluginReview }) => {
      sendJson(res, 200, pluginReview.buildOpenClawPluginSdkNativeContractTests(packagePathParams(requestUrl)));
    }),
  ],
  [
    "/workspaces/openclaw-plugin-sdk-native-contract-tests/summary",
    safeRoute(({ res, requestUrl, pluginReview }) => {
      const report = pluginReview.buildOpenClawPluginSdkNativeContractTests(packagePathParams(requestUrl));
      sendJson(res, 200, {
        ok: report.ok,
        registry: report.registry,
        mode: report.mode,
        generatedAt: report.generatedAt,
        sourceRegistries: report.sourceRegistries,
        summary: report.summary,
        governance: report.governance,
      });
    }),
  ],
  [
    "/plugins/openclaw-native-plugin-sdk-contract-implementation",
    safeRoute(({ res, requestUrl, pluginReview }) => {
      sendJson(res, 200, pluginReview.buildOpenClawNativePluginSdkContractImplementation(packagePathParams(requestUrl)));
    }),
  ],
  [
    "/plugins/openclaw-native-plugin-sdk-contract-implementation/summary",
    safeRoute(({ res, requestUrl, pluginReview }) => {
      const implementation = pluginReview.buildOpenClawNativePluginSdkContractImplementation(packagePathParams(requestUrl));
      sendJson(res, 200, {
        ok: implementation.ok,
        registry: implementation.registry,
        mode: implementation.mode,
        generatedAt: implementation.generatedAt,
        sourceRegistries: implementation.sourceRegistries,
        summary: implementation.summary,
        governance: implementation.governance,
      });
    }),
  ],
  [
    "/plugins/openclaw-tool-catalog",
    safeRoute(({ res, requestUrl, pluginReview }) => {
      sendJson(res, 200, pluginReview.buildOpenClawToolCatalog({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
      }));
    }),
  ],
  [
    "/plugins/openclaw-tool-catalog/summary",
    safeRoute(({ res, requestUrl, pluginReview }) => {
      const catalog = pluginReview.buildOpenClawToolCatalog({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
      });
      sendJson(res, 200, {
        ok: catalog.ok,
        registry: catalog.registry,
        mode: catalog.mode,
        generatedAt: catalog.generatedAt,
        sourceRegistries: catalog.sourceRegistries,
        capability: catalog.capability,
        summary: catalog.summary,
        governance: catalog.governance,
      });
    }),
  ],
  [
    "/plugins/openclaw-plugin-manifest-map",
    safeRoute(({ res, requestUrl, pluginReview }) => {
      sendJson(res, 200, pluginReview.buildOpenClawPluginManifestMap(manifestMapParams(requestUrl)));
    }),
  ],
  [
    "/plugins/openclaw-plugin-manifest-map/summary",
    safeRoute(({ res, requestUrl, pluginReview }) => {
      const manifestMap = pluginReview.buildOpenClawPluginManifestMap(manifestMapParams(requestUrl));
      sendJson(res, 200, {
        ok: manifestMap.ok,
        registry: manifestMap.registry,
        mode: manifestMap.mode,
        generatedAt: manifestMap.generatedAt,
        sourceRegistries: manifestMap.sourceRegistries,
        capability: manifestMap.capability,
        summary: manifestMap.summary,
        governance: manifestMap.governance,
      });
    }),
  ],
  [
    "/plugins/openclaw-native-plugin-contract",
    ({ res, pluginReview }) => {
      sendJson(res, 200, {
        ok: true,
        ...pluginReview.buildOpenClawNativePluginContractRegistry(),
      });
    },
  ],
  [
    "/plugins/openclaw-native-plugin-contract/summary",
    ({ res, pluginReview }) => {
      const registry = pluginReview.buildOpenClawNativePluginContractRegistry();
      sendJson(res, 200, {
        ok: true,
        registry: registry.registry,
        mode: registry.mode,
        generatedAt: registry.generatedAt,
        sourceRegistry: registry.sourceRegistry,
        sourceMode: registry.sourceMode,
        summary: registry.summary,
        validation: registry.validation,
      });
    },
  ],
  [
    "/plugins/openclaw-native-plugin-registry",
    ({ res, pluginReview }) => {
      sendJson(res, 200, pluginReview.buildOpenClawNativePluginRegistryResponse());
    },
  ],
  [
    "/plugins/openclaw-native-plugin-registry/summary",
    ({ res, pluginReview }) => {
      const registry = pluginReview.buildOpenClawNativePluginRegistryResponse();
      sendJson(res, 200, {
        ok: true,
        registry: registry.registry,
        mode: registry.mode,
        runtimeOwner: registry.runtimeOwner,
        activationMode: registry.activationMode,
        generatedAt: registry.generatedAt,
        validation: registry.validation,
        summary: registry.summary,
      });
    },
  ],
  [
    "/plugins/openclaw-formal-integration-readiness",
    ({ res, pluginReview }) => {
      sendJson(res, 200, {
        ok: true,
        ...pluginReview.buildOpenClawFormalIntegrationReadiness(),
      });
    },
  ],
  [
    "/plugins/openclaw-formal-integration-readiness/summary",
    ({ res, pluginReview }) => {
      const readiness = pluginReview.buildOpenClawFormalIntegrationReadiness();
      sendJson(res, 200, {
        ok: true,
        registry: readiness.registry,
        mode: readiness.mode,
        generatedAt: readiness.generatedAt,
        sourceRegistries: readiness.sourceRegistries,
        status: readiness.status,
        readyForFormalIntegration: readiness.readyForFormalIntegration,
        summary: readiness.summary,
      });
    },
  ],
  [
    "/plugins/openclaw-native-plugin-adapter",
    ({ res, pluginReview }) => {
      sendJson(res, 200, {
        ok: true,
        ...pluginReview.buildOpenClawNativePluginAdapterStatus(),
      });
    },
  ],
]);

export async function handleWorkspacePluginReadRoute({ req, res, requestUrl, pluginReview }) {
  if (req.method !== "GET") {
    return false;
  }

  const handler = WORKSPACE_PLUGIN_READ_ROUTES.get(requestUrl.pathname);
  if (!handler) {
    return false;
  }

  await handler({ res, requestUrl, pluginReview });
  return true;
}
