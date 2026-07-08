import { sendJson } from "../../../packages/shared-utils/src/http.mjs";

function parseLimit(searchParams) {
  return Number.parseInt(searchParams.get("limit") ?? "20", 10);
}

function clampLedgerLimit(limit) {
  return Number.isNaN(limit) ? 20 : Math.max(1, Math.min(limit, 100));
}

export async function handleObserverReadModelRoute({ req, res, requestUrl, state, planBuilder, executor }) {
  if (req.method !== "GET") {
    return false;
  }

  if (requestUrl.pathname === "/capabilities") {
    const registry = await planBuilder.buildCapabilityRegistry();
    sendJson(res, 200, {
      ok: true,
      ...registry,
    });
    return true;
  }

  if (requestUrl.pathname === "/capabilities/summary") {
    const registry = await planBuilder.buildCapabilityRegistry();
    sendJson(res, 200, {
      ok: true,
      registry: registry.registry,
      mode: registry.mode,
      generatedAt: registry.generatedAt,
      summary: registry.summary,
    });
    return true;
  }

  if (requestUrl.pathname === "/capabilities/invocations") {
    const limit = parseLimit(requestUrl.searchParams);
    const capabilityId = requestUrl.searchParams.get("capabilityId") ?? null;
    sendJson(res, 200, {
      ok: true,
      count: state.capabilityInvocationLog.length,
      items: planBuilder.listCapabilityInvocations({
        limit: Number.isNaN(limit) ? 20 : limit,
        capabilityId,
      }),
      summary: planBuilder.buildCapabilityInvocationSummary(),
    });
    return true;
  }

  if (requestUrl.pathname === "/capabilities/invocations/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: planBuilder.buildCapabilityInvocationSummary(),
    });
    return true;
  }

  if (requestUrl.pathname === "/commands/transcripts") {
    const safeLimit = clampLedgerLimit(parseLimit(requestUrl.searchParams));
    const items = executor.listCommandTranscriptRecords({ limit: safeLimit });
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: executor.serialiseCommandTranscriptSummary(executor.buildCommandTranscriptSummary()),
    });
    return true;
  }

  if (requestUrl.pathname === "/commands/transcripts/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: executor.serialiseCommandTranscriptSummary(executor.buildCommandTranscriptSummary()),
    });
    return true;
  }

  if (requestUrl.pathname === "/filesystem/changes") {
    const safeLimit = clampLedgerLimit(parseLimit(requestUrl.searchParams));
    const items = executor.listFilesystemChangeRecords({ limit: safeLimit });
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: executor.serialiseFilesystemChangeSummary(executor.buildFilesystemChangeSummary()),
    });
    return true;
  }

  if (requestUrl.pathname === "/filesystem/changes/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: executor.serialiseFilesystemChangeSummary(executor.buildFilesystemChangeSummary()),
    });
    return true;
  }

  if (requestUrl.pathname === "/filesystem/reads") {
    const safeLimit = clampLedgerLimit(parseLimit(requestUrl.searchParams));
    const items = executor.listFilesystemReadRecords({ limit: safeLimit });
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: executor.serialiseFilesystemReadSummary(executor.buildFilesystemReadSummary()),
    });
    return true;
  }

  if (requestUrl.pathname === "/filesystem/reads/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: executor.serialiseFilesystemReadSummary(executor.buildFilesystemReadSummary()),
    });
    return true;
  }

  return false;
}
