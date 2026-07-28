export const observerClientRuntimeAiWorkspaceProjectionScript = `const AI_WORKSPACE_PROJECTION_INTERVAL_MS = 5000;
let aiWorkspaceProjectionMode = "browser";
let aiWorkspaceProjectionRequest = null;

function clearAiWorkspaceProjection(reason = "unavailable") {
  aiWorkspaceProjectionFrame.removeAttribute("src");
  aiWorkspaceProjectionFrame.hidden = true;
  aiWorkspaceProjectionStatus.textContent = reason;
}

async function validatedAiWorkspaceProjection(data) {
  const frame = data?.frame ?? {};
  const boundary = data?.boundary ?? {};
  if (data?.registry !== "nixsoma-ai-output-projection-v0"
    || data.mode !== "operator_transient"
    || frame.registry !== "nixsoma-ai-compositor-frame-v0"
    || frame.available !== true
    || frame.fresh !== true
    || frame.sourceScope !== "ai_owned_nested_output_only"
    || frame.captureApi !== "weston_output_capture_v1"
    || frame.socketName !== "nixsoma-ai-0"
    || frame.mediaType !== "image/png"
    || frame.width !== 1280
    || frame.height !== 720
    || !Number.isInteger(frame.byteLength)
    || frame.byteLength < 1
    || frame.byteLength > 262144
    || typeof frame.sha256 !== "string"
    || !/^[a-f0-9]{64}$/u.test(frame.sha256)
    || frame.dataExposed !== true
    || frame.persisted !== false
    || typeof frame.dataUrl !== "string"
    || !frame.dataUrl.startsWith("data:image/png;base64,")
    || boundary.operatorAuthenticationRequired !== true
    || boundary.serverPersistence !== false
    || boundary.browserMemoryOnly !== true
    || boundary.parentDisplayConnected !== false
    || boundary.desktopWideCapture !== false
    || boundary.inputAuthorityExpanded !== false
    || boundary.rootRequired !== false
    || boundary.hostMutation !== false) {
    throw new Error("invalid_projection_contract");
  }
  const bytes = Uint8Array.from(atob(frame.dataUrl.slice("data:image/png;base64,".length)), (value) => value.charCodeAt(0));
  if (bytes.byteLength !== frame.byteLength
    || bytes.length < 8
    || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) {
    throw new Error("invalid_projection_bytes");
  }
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  if (digest !== frame.sha256) throw new Error("invalid_projection_hash");
  return frame;
}

async function refreshAiWorkspaceProjection() {
  if (aiWorkspaceProjectionMode !== "workspace") return;
  if (document.visibilityState !== "visible") {
    clearAiWorkspaceProjection("paused");
    return;
  }
  if (!operatorSession?.authenticated) {
    clearAiWorkspaceProjection("operator auth required");
    return;
  }
  if (aiWorkspaceProjectionRequest) return aiWorkspaceProjectionRequest;
  aiWorkspaceProjectionStatus.textContent = "loading";
  aiWorkspaceProjectionRequest = (async () => {
    try {
      const data = await fetchJson(\`\${observerConfig.coreUrl}/proxy/session-manager/work-view/compositor-frame\`);
      const frame = await validatedAiWorkspaceProjection(data);
      if (aiWorkspaceProjectionMode !== "workspace"
        || document.visibilityState !== "visible"
        || !operatorSession?.authenticated) return;
      aiWorkspaceProjectionFrame.src = frame.dataUrl;
      aiWorkspaceProjectionFrame.hidden = false;
      aiWorkspaceProjectionStatus.textContent = \`fresh \${frame.width}x\${frame.height} \${frame.byteLength}B seq=\${frame.sequence}\`;
    } catch {
      clearAiWorkspaceProjection("unavailable");
    } finally {
      aiWorkspaceProjectionRequest = null;
    }
  })();
  return aiWorkspaceProjectionRequest;
}

function selectAiWorkspaceProjectionMode(mode) {
  aiWorkspaceProjectionMode = mode === "workspace" ? "workspace" : "browser";
  const workspaceSelected = aiWorkspaceProjectionMode === "workspace";
  browserPagePreviewTab.setAttribute("aria-selected", String(!workspaceSelected));
  aiWorkspacePreviewTab.setAttribute("aria-selected", String(workspaceSelected));
  browserPagePreview.hidden = workspaceSelected;
  aiWorkspacePreview.hidden = !workspaceSelected;
  if (workspaceSelected) {
    refreshAiWorkspaceProjection();
  } else {
    clearAiWorkspaceProjection("not selected");
  }
}

browserPagePreviewTab.addEventListener("click", () => selectAiWorkspaceProjectionMode("browser"));
aiWorkspacePreviewTab.addEventListener("click", () => selectAiWorkspaceProjectionMode("workspace"));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    clearAiWorkspaceProjection("paused");
  } else if (aiWorkspaceProjectionMode === "workspace") {
    refreshAiWorkspaceProjection();
  }
});
setInterval(() => {
  refreshAiWorkspaceProjection();
}, AI_WORKSPACE_PROJECTION_INTERVAL_MS);
`;
