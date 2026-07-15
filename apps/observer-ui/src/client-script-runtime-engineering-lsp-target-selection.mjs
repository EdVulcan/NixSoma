export const observerClientRuntimeEngineeringLspTargetSelectionScript = `let latestEngineeringLspTargetSelection = {
  taskId: null,
  targetIndex: 0,
  targets: [],
};

function engineeringLspTargetRangeText(target) {
  const start = target?.range?.start ?? {};
  const end = target?.range?.end ?? {};
  return \`\${start.line ?? "?"}:\${start.character ?? "?"}-\${end.line ?? "?"}:\${end.character ?? "?"}\`;
}

function engineeringLspTargetDisplayText(target, index) {
  const uri = typeof target?.uri === "string" && target.uri.trim() ? target.uri : "unknown URI";
  return \`Target \${index + 1}: \${uri} (\${engineeringLspTargetRangeText(target)})\`;
}

function engineeringLspTargetSelectionSummary() {
  const selected = latestEngineeringLspTargetSelection.targets[latestEngineeringLspTargetSelection.targetIndex] ?? null;
  return selected
    ? \`Target \${latestEngineeringLspTargetSelection.targetIndex + 1}/\${latestEngineeringLspTargetSelection.targets.length}: \${engineeringLspTargetDisplayText(selected, latestEngineeringLspTargetSelection.targetIndex)}\`
    : "No completed LSP symbol response target is available.";
}

function engineeringLspSelectedTargetIndex() {
  return latestEngineeringLspTargetSelection.targetIndex ?? 0;
}

function updateEngineeringLspTargetSelectionSummary() {
  if (engineeringLspTargetSelectionStatus) {
    engineeringLspTargetSelectionStatus.textContent = engineeringLspTargetSelectionSummary();
  }
  if (engineeringLspTargetSelect) {
    engineeringLspTargetSelect.value = String(latestEngineeringLspTargetSelection.targetIndex);
  }
}

function renderEngineeringLspTargetSelection(symbolResponse = null) {
  const targets = Array.isArray(symbolResponse?.targets)
    ? symbolResponse.targets.slice(0, 8)
    : [];
  const taskId = latestEngineeringLoopControlState?.taskId ?? null;
  const previousTaskMatches = latestEngineeringLspTargetSelection.taskId === taskId;
  const previousIndex = previousTaskMatches
    ? latestEngineeringLspTargetSelection.targetIndex
    : latestEngineeringLoopControlState?.selectedTargetIndex ?? 0;
  const targetIndex = targets.length > 0 && Number.isInteger(previousIndex) && previousIndex >= 0 && previousIndex < targets.length
    ? previousIndex
    : 0;

  latestEngineeringLspTargetSelection = { taskId, targetIndex, targets };
  if (latestEngineeringLoopControlState?.kind === "lsp-lifecycle") {
    latestEngineeringLoopControlState.selectedTargetIndex = targetIndex;
  }

  if (!engineeringLspTargetSelectionPanel || !engineeringLspTargetSelect) {
    return;
  }
  engineeringLspTargetSelect.innerHTML = "";
  engineeringLspTargetSelect.disabled = targets.length === 0;
  engineeringLspTargetSelectionPanel.hidden = targets.length === 0;
  for (const [index, target] of targets.entries()) {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = engineeringLspTargetDisplayText(target, index);
    engineeringLspTargetSelect.append(option);
  }
  updateEngineeringLspTargetSelectionSummary();
}

function selectEngineeringLspTarget(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= latestEngineeringLspTargetSelection.targets.length) {
    return;
  }
  latestEngineeringLspTargetSelection.targetIndex = parsed;
  if (latestEngineeringLoopControlState?.kind === "lsp-lifecycle") {
    latestEngineeringLoopControlState.selectedTargetIndex = parsed;
  }
  updateEngineeringLspTargetSelectionSummary();
  if (engineeringLoopStateNext) {
    engineeringLoopStateNext.textContent = "read or seed the explicitly selected LSP target";
  }
  if (engineeringLoopStateJson) {
    const existing = String(engineeringLoopStateJson.textContent ?? "");
    const base = existing.split("\\n\\nTarget Selection:")[0];
    engineeringLoopStateJson.textContent = [
      base,
      "Target Selection:",
      \`index=\${parsed} total=\${latestEngineeringLspTargetSelection.targets.length}\`,
      \`target=\${engineeringLspTargetDisplayText(latestEngineeringLspTargetSelection.targets[parsed], parsed)}\`,
      "Boundary: target selection is read-only; Read Selected Target and Seed Edit Proposal remain explicit controls.",
    ].join("\\n\\n");
  }
  setControlMessage(\`Selected LSP response target \${parsed + 1}; read and edit seed actions remain explicit.\`);
}

engineeringLspTargetSelect?.addEventListener("change", () => {
  selectEngineeringLspTarget(engineeringLspTargetSelect.value);
});
`;
