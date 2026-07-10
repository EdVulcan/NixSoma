export const observerClientMvpPhaseRefreshersScript = `async function refreshMvpRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/mvp/route\`);
    const summary = data.summary ?? {};
    mvpRouteCurrent.textContent = data.mainline?.current ?? "unknown";
    mvpRouteTrunk.textContent = data.mainline?.trunk ?? "unknown";
    mvpRouteComplete.textContent = \`\${summary.complete ?? 0}/\${summary.totalPhases ?? 0}\`;
    mvpRouteNext.textContent = data.mainline?.nextRecommendedTrunk ?? summary.next ?? "unknown";
    mvpRouteJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`MVP Boundary: \${data.whitepaper?.mvpBoundary ?? "unknown"}\`,
      \`Current: \${data.mainline?.current ?? "unknown"}\`,
      \`Next Recommended Trunk: \${data.mainline?.nextRecommendedTrunk ?? "unknown"}\`,
      \`Next Milestone: \${data.mainline?.nextRecommendedMilestone ?? "unknown"}\`,
      \`Guardrail: \${(data.guardrails?.afterEachMilestone ?? []).join("; ") || "none"}\`,
      \`Avoid: \${(data.guardrails?.avoidLoops ?? []).join("; ") || "none"}\`,
      "",
      JSON.stringify(data.phases ?? [], null, 2),
    ].join("\\n");
  } catch {
    mvpRouteCurrent.textContent = "offline";
    mvpRouteJson.textContent = "Unable to read MVP route alignment.";
  }
}

async function refreshPhase2RepairDemoStatus() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/repair-demo-status\`);
    const summary = data.summary ?? {};
    const checklist = data.checklist ?? [];
    phase2RepairDemoStatus.textContent = data.status ?? "unknown";
    phase2RepairDemoEvidence.textContent = \`\${summary.passed ?? 0}/\${summary.total ?? checklist.length}\`;
    phase2RepairDemoTarget.textContent = summary.targetUnit ?? "openclaw-browser-runtime.service";
    phase2RepairDemoNext.textContent = data.route?.nextRecommendedSlice ?? "demo evidence bundle";
    phase2RepairDemoJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} readOnly=\${Boolean(data.governance?.readOnly)} executesCommand=\${Boolean(data.governance?.executesCommand)}\`,
      \`Status: \${data.status ?? "unknown"} demoReady=\${Boolean(summary.demoReady)}\`,
      \`Task: \${summary.latestTaskId ?? "none"} outcome=\${summary.latestOutcome ?? "none"}\`,
      \`Command: \${summary.command ?? "none"} exitCode=\${summary.exitCode ?? "none"}\`,
      \`Body: before=\${summary.beforeActiveState ?? "unknown"} after=\${summary.afterActiveState ?? "unknown"} serviceOk=\${summary.beforeServiceOk ?? "unknown"}->\${summary.afterServiceOk ?? "unknown"}\`,
      \`No Automatic Recovery: \${Boolean(summary.noAutomaticRecovery)}\`,
      \`Next: \${data.route?.nextRecommendedSlice ?? "unknown"} avoidsSafetyBoundaryLoop=\${Boolean(data.route?.avoidsSafetyBoundaryLoop)}\`,
      "",
      ...(checklist.map((item) => \`[\${item.status ?? "unknown"}] \${item.id ?? "check"} :: \${item.label ?? "no label"} evidence=\${item.evidence ?? "none"}\`)),
    ].join("\\n");
  } catch {
    phase2RepairDemoStatus.textContent = "offline";
    phase2RepairDemoEvidence.textContent = "0/0";
    phase2RepairDemoTarget.textContent = "offline";
    phase2RepairDemoNext.textContent = "unknown";
    phase2RepairDemoJson.textContent = "Unable to read Phase 2 repair demo status.";
  }
}

async function refreshPhase2NextRepairDemoStatus() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/next-repair-demo-status\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checklist = data.checklist ?? [];
    phase2NextRepairDemoStatus.textContent = data.status ?? "unknown";
    phase2NextRepairDemoEvidence.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checklist.length}\`;
    phase2NextRepairDemoTarget.textContent = summary.targetUnit ?? "openclaw-system-sense.service";
    phase2NextRepairDemoMutation.textContent = String(Boolean(governance.hostMutation));
    phase2NextRepairDemoJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-systemd-next-repair-demo-status-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} readsTaskHistoryOnly=\${Boolean(governance.readsTaskHistoryOnly)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)}\`,
      \`Status: \${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} target=\${summary.targetUnit ?? "unknown"}\`,
      \`Outcome: \${summary.outcome ?? "none"} hostMutationAttempted=\${Boolean(summary.hostMutationAttempted)} executionSucceeded=\${summary.executionSucceeded ?? "unknown"}\`,
      \`Command: \${summary.command ?? "none"} exitCode=\${summary.exitCode ?? "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-timeline"} boundary=\${data.next?.boundary ?? "read-only body memory"}\`,
      "",
      ...(checklist.map((item) => \`[\${item.status ?? "unknown"}] \${item.id ?? "check"} :: \${item.label ?? "no label"} evidence=\${typeof item.evidence === "string" ? item.evidence : JSON.stringify(item.evidence ?? null)}\`)),
    ].join("\\n");
  } catch {
    phase2NextRepairDemoStatus.textContent = "offline";
    phase2NextRepairDemoEvidence.textContent = "0/0";
    phase2NextRepairDemoTarget.textContent = "offline";
    phase2NextRepairDemoMutation.textContent = "false";
    phase2NextRepairDemoJson.textContent = "Unable to read Phase 2 next repair demo status.";
  }
}

async function refreshPhase2DemoControlRoom() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/demo-control-room\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const evidence = data.evidence ?? {};
    phase2DemoControlRoomStatus.textContent = data.status ?? "unknown";
    phase2DemoControlRoomPanels.textContent = \`\${summary.availablePanels ?? 0}/\${summary.totalPanels ?? 0}\`;
    phase2DemoControlRoomSlice.textContent = summary.selectedSlice ?? "unknown";
    phase2DemoControlRoomMutation.textContent = String(Boolean(governance.mutatesHost));
    phase2DemoControlRoomJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutatesHost=\${Boolean(governance.mutatesHost)}\`,
      \`Status: \${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} panels=\${summary.availablePanels ?? 0}/\${summary.totalPanels ?? 0}\`,
      \`Route: track=\${summary.selectedTrack ?? "unknown"} slice=\${summary.selectedSlice ?? "unknown"} avoidsSafetyBoundaryLoop=\${Boolean(summary.avoidsSafetyBoundaryLoop)}\`,
      \`Repair Demo: status=\${summary.repairDemoStatus ?? "unknown"} ready=\${Boolean(summary.repairDemoReady)} target=\${evidence.repairDemo?.targetUnit ?? "unknown"}\`,
      \`Body Governance: ready=\${Boolean(summary.bodyGovernanceReady)} routeReview=\${data.source?.routeReviewRegistry ?? "unknown"}\`,
      \`Panels: \${(data.panels ?? []).map((panel) => \`\${panel.id}=\${panel.status}\`).join(", ")}\`,
      \`Script: \${(data.operatorScript ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "demo walkthrough"}\`,
    ].join("\\n");
  } catch {
    phase2DemoControlRoomStatus.textContent = "offline";
    phase2DemoControlRoomPanels.textContent = "0/0";
    phase2DemoControlRoomSlice.textContent = "unknown";
    phase2DemoControlRoomMutation.textContent = "false";
    phase2DemoControlRoomJson.textContent = "Unable to read Phase 2 demo control room.";
  }
}

async function refreshPhase2DemoWalkthrough() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/demo-walkthrough\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    phase2DemoWalkthroughStatus.textContent = data.status ?? "unknown";
    phase2DemoWalkthroughSteps.textContent = \`\${summary.readySteps ?? 0}/\${summary.totalSteps ?? 0}\`;
    phase2DemoWalkthroughControlRoom.textContent = String(Boolean(summary.controlRoomReady));
    phase2DemoWalkthroughMutation.textContent = String(Boolean(governance.mutatesHost));
    phase2DemoWalkthroughJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutatesHost=\${Boolean(governance.mutatesHost)}\`,
      \`Status: \${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} steps=\${summary.readySteps ?? 0}/\${summary.totalSteps ?? 0}\`,
      \`Evidence: controlRoomReady=\${Boolean(summary.controlRoomReady)} bodyGovernanceReady=\${Boolean(summary.bodyGovernanceReady)} repairDemoReady=\${Boolean(summary.repairDemoReady)}\`,
      \`Steps: \${(data.steps ?? []).map((step) => \`\${step.id}=\${step.status}\`).join(", ")}\`,
      \`Script: \${(data.script ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "demo readiness exit"}\`,
    ].join("\\n");
  } catch {
    phase2DemoWalkthroughStatus.textContent = "offline";
    phase2DemoWalkthroughSteps.textContent = "0/0";
    phase2DemoWalkthroughControlRoom.textContent = "false";
    phase2DemoWalkthroughMutation.textContent = "false";
    phase2DemoWalkthroughJson.textContent = "Unable to read Phase 2 demo walkthrough.";
  }
}

async function refreshPhase2DemoReadinessExit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/demo-readiness-exit\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const operatorOutcome = data.operatorOutcome ?? {};
    const completedBlock = data.completedBlock ?? {};
    phase2DemoReadinessExitStatus.textContent = data.status ?? "unknown";
    phase2DemoReadinessExitChecks.textContent = \`\${summary.passed ?? 0}/\${summary.total ?? 0}\`;
    phase2DemoReadinessExitSafe.textContent = String(Boolean(operatorOutcome.safeToDemo));
    phase2DemoReadinessExitMutation.textContent = String(Boolean(governance.mutatesHost));
    phase2DemoReadinessExitJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutatesHost=\${Boolean(governance.mutatesHost)}\`,
      \`Status: \${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} checks=\${summary.passed ?? 0}/\${summary.total ?? 0}\`,
      \`Outcome: safeToDemo=\${Boolean(operatorOutcome.safeToDemo)} hiddenMutation=\${Boolean(operatorOutcome.hiddenMutation)}\`,
      \`Completed: \${completedBlock.name ?? "unknown"} claim=\${completedBlock.completionClaim ?? "unknown"}\`,
      \`Slices: \${(completedBlock.completedSlices ?? []).join(", ")}\`,
      \`Checks: \${(data.exitChecks ?? []).map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "next capability route review"}\`,
    ].join("\\n");
  } catch {
    phase2DemoReadinessExitStatus.textContent = "offline";
    phase2DemoReadinessExitChecks.textContent = "0/0";
    phase2DemoReadinessExitSafe.textContent = "false";
    phase2DemoReadinessExitMutation.textContent = "false";
    phase2DemoReadinessExitJson.textContent = "Unable to read Phase 2 demo readiness exit.";
  }
}

async function refreshPhase2NextCapabilityRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/next-capability-route-review\`);
    const decision = data.decision ?? {};
    const governance = data.governance ?? {};
    const evidence = data.evidence ?? {};
    const nextSlice = data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-plan";
    phase2NextCapabilityTrack.textContent = decision.selectedTrack ?? "unknown";
    phase2NextCapabilitySlice.textContent = decision.selectedSlice ?? nextSlice;
    phase2NextCapabilityCreatesTask.textContent = String(Boolean(governance.createsTask));
    phase2NextCapabilityMutation.textContent = String(Boolean(governance.mutatesHost));
    phase2NextCapabilityJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutatesHost=\${Boolean(governance.mutatesHost)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: demoReady=\${Boolean(evidence.demoReady)} exitChecks=\${evidence.demoExitChecks ?? "0/0"} candidateDemoReady=\${Boolean(evidence.candidateDemoReady)} timelineReady=\${Boolean(evidence.bodyEvidenceTimelineReady)} followupReadinessReady=\${Boolean(evidence.bodyEvidenceLedgerFollowupRecordReadinessReady)} followupTask=\${evidence.bodyEvidenceLedgerFollowupTaskId ?? "none"} candidateUnit=\${evidence.candidateDemoSelectedUnit ?? "none"} completed=\${evidence.completedDemoBlock?.completionClaim ?? "unknown"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.track}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}\`).join(", ")}\`,
      \`Next: \${nextSlice}\`,
    ].join("\\n");
  } catch {
    phase2NextCapabilityTrack.textContent = "offline";
    phase2NextCapabilitySlice.textContent = "unknown";
    phase2NextCapabilityCreatesTask.textContent = "false";
    phase2NextCapabilityMutation.textContent = "false";
    phase2NextCapabilityJson.textContent = "Unable to read Phase 2 next capability route review.";
  }
}

async function refreshPhase2CompletionReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/completion-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    phase2CompletionReadinessReady.textContent = String(Boolean(summary.ready));
    phase2CompletionReadinessChecks.textContent = \`\${summary.passed ?? 0}/\${summary.total ?? 0}\`;
    phase2CompletionReadinessPercent.textContent = String(summary.completionPercent ?? 0);
    phase2CompletionReadinessMutation.textContent = String(Boolean(governance.mutatesHost));
    phase2CompletionReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-phase-2-completion-readiness-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} status=\${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} percent=\${summary.completionPercent ?? 0}\`,
      \`Checks: \${summary.passed ?? 0}/\${summary.total ?? 0} firstRepair=\${Boolean(summary.firstRepairDemoReady)} nextRepair=\${Boolean(summary.nextRepairDemoReady)} candidate=\${Boolean(summary.candidateDemoReady)} demoExit=\${Boolean(summary.demoExitReady)} governance=\${Boolean(summary.bodyGovernanceReady)} ledgerRecords=\${summary.durableBodyMemoryRecords ?? 0}\`,
      \`Follow-up: record=\${summary.followupRecordId ?? "none"}\`,
      \`Governance: readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutatesHost=\${Boolean(governance.mutatesHost)} scheduler=\${Boolean(governance.schedulesWork)} backgroundWriter=\${Boolean(governance.backgroundWriter)} writesLedger=\${Boolean(governance.writesLedger)}\`,
      \`Next: \${data.next?.recommendedSlice ?? "unknown"} boundary=\${data.next?.boundary ?? "unknown"}\`,
    ].join("\\n");
  } catch {
    phase2CompletionReadinessReady.textContent = "false";
    phase2CompletionReadinessChecks.textContent = "0/0";
    phase2CompletionReadinessPercent.textContent = "0";
    phase2CompletionReadinessMutation.textContent = "false";
    phase2CompletionReadinessJson.textContent = "Unable to read Phase 2 completion readiness.";
  }
}

async function refreshPhase2Exit() {
  try {
    const phase2ExitNextFallback = "openclaw-phase-3-plan";
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/exit\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    phase2ExitComplete.textContent = String(Boolean(summary.complete));
    phase2ExitPercent.textContent = String(summary.completionPercent ?? 0);
    phase2ExitNext.textContent = data.next?.recommendedSlice ?? phase2ExitNextFallback;
    phase2ExitMutation.textContent = String(Boolean(governance.mutatesHost));
    phase2ExitJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-phase-2-exit-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} status=\${data.status ?? "unknown"} complete=\${Boolean(summary.complete)} percent=\${summary.completionPercent ?? 0}\`,
      \`Readiness: status=\${summary.readinessStatus ?? "unknown"} checks=\${summary.passed ?? 0}/\${summary.total ?? 0} records=\${summary.durableBodyMemoryRecords ?? 0} followup=\${summary.followupRecordId ?? "none"}\`,
      \`Completed: \${data.completedPhase?.completionClaim ?? "unknown"} tracks=\${(data.completedPhase?.completedTracks ?? []).length}\`,
      \`Governance: readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutatesHost=\${Boolean(governance.mutatesHost)} scheduler=\${Boolean(governance.schedulesWork)} backgroundWriter=\${Boolean(governance.backgroundWriter)} writesLedger=\${Boolean(governance.writesLedger)}\`,
      \`Next: \${data.next?.recommendedSlice ?? phase2ExitNextFallback} boundary=\${data.next?.boundary ?? "unknown"}\`,
    ].join("\\n");
  } catch {
    phase2ExitComplete.textContent = "false";
    phase2ExitPercent.textContent = "0";
    phase2ExitNext.textContent = "openclaw-phase-3-plan";
    phase2ExitMutation.textContent = "false";
    phase2ExitJson.textContent = "Unable to read Phase 2 exit gate.";
  }
}

async function refreshPhase3Plan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-3/plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    phase3PlanReady.textContent = String(Boolean(summary.ready));
    phase3PlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-phase-3-background-work-view";
    phase3PlanForeground.textContent = String(Boolean(governance.stealsForeground));
    phase3PlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-3-plan-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown") + " ready=" + Boolean(summary.ready),
      "Theme: " + (data.whitepaperAlignment?.phaseTheme ?? "Let it work without stealing the foreground."),
      "Slices: " + ((data.selectedSlices ?? []).join(", ") || "none"),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    phase3PlanReady.textContent = "false";
    phase3PlanNext.textContent = "unknown";
    phase3PlanForeground.textContent = "false";
    phase3PlanJson.textContent = "Unable to read Phase 3 plan.";
  }
}

async function refreshPhase3BackgroundWorkView() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-3/background-work-view\`);
    const summary = data.summary ?? {};
    const workView = data.current?.workView ?? {};
    const trustedSession = data.workViewContract?.trustedSession ?? workView.trustedSession ?? {};
    const sessionIdentity = trustedSession.sessionIdentity ?? {};
    phase3BackgroundReady.textContent = String(Boolean(summary.ready));
    phase3BackgroundVisibility.textContent = workView.visibility ?? data.workViewContract?.defaultVisibility ?? "hidden";
    phase3BackgroundMode.textContent = workView.mode ?? data.workViewContract?.defaultMode ?? "background";
    phase3BackgroundJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-3-background-work-view-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " checks=" + (summary.passed ?? 0) + "/" + (summary.total ?? 0),
      "Default: visibility=" + (data.workViewContract?.defaultVisibility ?? "hidden") + " mode=" + (data.workViewContract?.defaultMode ?? "background"),
      "Current: visibility=" + (workView.visibility ?? "unknown") + " mode=" + (workView.mode ?? "unknown") + " capture=" + (workView.captureStrategy ?? "unknown"),
      "Trusted Session: " + (trustedSession.identityLevel ?? "unknown") + " readiness=" + (trustedSession.readiness ?? "unknown"),
      "Session Identity: " + (sessionIdentity.status ?? "unknown") + " authority=" + (sessionIdentity.authority ?? "unknown") + " authoritative=" + (sessionIdentity.authoritativeSessionId ?? "none") + " browser=" + (sessionIdentity.browserRuntimeSessionId ?? "none"),
      "Trusted Boundary: " + (trustedSession.boundary?.workViewScope ?? "unknown") + " revealGate=" + (trustedSession.operatorGates?.reveal ?? "unknown"),
      "Helper Readiness: " + (trustedSession.helperReadiness?.state ?? "unknown") + " recovery=" + (trustedSession.recoveryRecommendation?.action ?? "unknown"),
      "Last Operator Action: " + (workView.lastOperatorAction?.action ?? "none") + " source=" + (workView.lastOperatorAction?.source ?? "none"),
      "Sidecar Contract: " + (trustedSession.sidecarContract?.status ?? "unknown") + " processStarted=" + String(Boolean(trustedSession.sidecarContract?.lifecycle?.processStarted)),
      "Sidecar Lifecycle: " + (trustedSession.sidecarContract?.lifecycleProposal?.status ?? "unknown") + " execution=" + (trustedSession.sidecarContract?.lifecycleProposal?.executionStatus ?? "unknown"),
      "Sidecar Approval Draft: " + (trustedSession.sidecarContract?.approvalTaskDraft?.status ?? "unknown") + " createsTask=" + String(Boolean(trustedSession.sidecarContract?.approvalTaskDraft?.createsTaskNow)),
    ].join("\\n");
  } catch {
    phase3BackgroundReady.textContent = "false";
    phase3BackgroundVisibility.textContent = "unknown";
    phase3BackgroundMode.textContent = "unknown";
    phase3BackgroundJson.textContent = "Unable to read Phase 3 background work view.";
  }
}

async function refreshPhase3OperatorInterruptControls() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-3/operator-interrupt-controls\`);
    const summary = data.summary ?? {};
    phase3ControlsReady.textContent = String(Boolean(summary.ready));
    phase3ControlsTakeover.textContent = String(Boolean(summary.takeoverSupported));
    phase3ControlsHiddenAutomation.textContent = String(Boolean(summary.hiddenAutomation));
    const sidecarLifecycle = data.sidecarLifecycle ?? {};
    const latestProbe = sidecarLifecycle.latestProbe ?? {};
    const safety = sidecarLifecycle.safety ?? {};
    phase3ControlsJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-3-operator-interrupt-controls-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Controls: " + ((data.controls ?? []).map((control) => control.id + " " + control.endpoint).join(" | ") || "none"),
      "Operator: status=" + (data.operator?.status ?? "unknown") + " blocked=" + Boolean(data.operator?.blocked),
      "Sidecar: task=" + (sidecarLifecycle.taskId ?? "none") + " approval=" + (sidecarLifecycle.approvalStatus ?? "none") + " probe=" + (latestProbe.status ?? "none") + " processStarted=" + Boolean(safety.processStarted),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    phase3ControlsReady.textContent = "false";
    phase3ControlsTakeover.textContent = "false";
    phase3ControlsHiddenAutomation.textContent = "false";
    phase3ControlsJson.textContent = "Unable to read Phase 3 operator controls.";
  }
}

async function refreshPhase3CompletionReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-3/completion-readiness\`);
    const summary = data.summary ?? {};
    phase3ReadinessReady.textContent = String(Boolean(summary.ready));
    phase3ReadinessChecks.textContent = (summary.passed ?? 0) + "/" + (summary.total ?? 0);
    phase3ReadinessPercent.textContent = String(summary.completionPercent ?? 0);
    phase3ReadinessJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-3-completion-readiness-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Foreground Steal: " + Boolean(summary.foregroundStealByDefault),
      "Tracks: " + ((data.completedTracks ?? []).map((track) => track.id + "=" + track.status).join(" | ") || "none"),
    ].join("\\n");
  } catch {
    phase3ReadinessReady.textContent = "false";
    phase3ReadinessChecks.textContent = "0/0";
    phase3ReadinessPercent.textContent = "0";
    phase3ReadinessJson.textContent = "Unable to read Phase 3 completion readiness.";
  }
}

async function refreshPhase3Exit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-3/exit\`);
    const summary = data.summary ?? {};
    phase3ExitComplete.textContent = String(Boolean(summary.complete));
    phase3ExitPercent.textContent = String(summary.completionPercent ?? 0);
    phase3ExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-phase-4-plan";
    phase3ExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-3-exit-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Completed: " + (data.completedPhase?.completionClaim ?? "unknown"),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-phase-4-plan"),
    ].join("\\n");
  } catch {
    phase3ExitComplete.textContent = "false";
    phase3ExitPercent.textContent = "0";
    phase3ExitNext.textContent = "openclaw-phase-4-plan";
    phase3ExitJson.textContent = "Unable to read Phase 3 exit gate.";
  }
}

async function refreshPhase4Plan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-4/plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    phase4PlanReady.textContent = String(Boolean(summary.ready));
    phase4PlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-phase-4-self-heal-loop";
    phase4PlanRealRepair.textContent = String(Boolean(governance.realHostRepair));
    phase4PlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-4-plan-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown") + " ready=" + Boolean(summary.ready),
      "Theme: " + (data.whitepaperAlignment?.phaseTheme ?? "Let it care for its body."),
      "Slices: " + ((data.selectedSlices ?? []).join(", ") || "none"),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    phase4PlanReady.textContent = "false";
    phase4PlanNext.textContent = "unknown";
    phase4PlanRealRepair.textContent = "false";
    phase4PlanJson.textContent = "Unable to read Phase 4 plan.";
  }
}

async function refreshPhase4SelfHealLoop() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-4/self-heal-loop\`);
    const summary = data.summary ?? {};
    phase4SelfHealReady.textContent = String(Boolean(summary.ready));
    phase4SelfHealExecuted.textContent = String(summary.executedRepairs ?? 0);
    phase4SelfHealSkipped.textContent = String(summary.skippedHighRisk ?? 0);
    phase4SelfHealJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-4-self-heal-loop-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " checks=" + (summary.passed ?? 0) + "/" + (summary.total ?? 0),
      "Diagnosis: " + (data.diagnosis?.status ?? "unknown") + " steps=" + (data.diagnosis?.planSteps ?? 0),
      "Maintenance: run=" + (data.maintenance?.latestRunId ?? "none") + " status=" + (data.maintenance?.status ?? "unknown") + " executed=" + (summary.executedRepairs ?? 0) + " skipped=" + (summary.skippedHighRisk ?? 0),
    ].join("\\n");
  } catch {
    phase4SelfHealReady.textContent = "false";
    phase4SelfHealExecuted.textContent = "0";
    phase4SelfHealSkipped.textContent = "0";
    phase4SelfHealJson.textContent = "Unable to read Phase 4 self-heal loop.";
  }
}

async function refreshPhase4HealHistoryEvidence() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-4/heal-history-evidence\`);
    const summary = data.summary ?? {};
    const history = data.history ?? {};
    phase4HistoryReady.textContent = String(Boolean(summary.ready));
    phase4HistoryHealCount.textContent = String(history.healCount ?? 0);
    phase4HistoryMaintenanceCount.textContent = String(history.maintenanceCount ?? 0);
    phase4HistoryJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-4-heal-history-evidence-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " checks=" + (summary.passed ?? 0) + "/" + (summary.total ?? 0),
      "History: heal=" + (history.healCount ?? 0) + " maintenance=" + (history.maintenanceCount ?? 0) + " latestRun=" + (history.latestRunId ?? "none"),
      "Evidence: executed=" + (history.executedRepairs ?? 0) + " skipped=" + (history.skippedHighRisk ?? 0),
    ].join("\\n");
  } catch {
    phase4HistoryReady.textContent = "false";
    phase4HistoryHealCount.textContent = "0";
    phase4HistoryMaintenanceCount.textContent = "0";
    phase4HistoryJson.textContent = "Unable to read Phase 4 heal history evidence.";
  }
}

async function refreshPhase4CompletionReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-4/completion-readiness\`);
    const summary = data.summary ?? {};
    phase4ReadinessReady.textContent = String(Boolean(summary.ready));
    phase4ReadinessChecks.textContent = (summary.passed ?? 0) + "/" + (summary.total ?? 0);
    phase4ReadinessPercent.textContent = String(summary.completionPercent ?? 0);
    phase4ReadinessJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-4-completion-readiness-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Evidence: services=" + (summary.servicesObserved ?? 0) + " executed=" + (summary.executedRepairs ?? 0) + " skipped=" + (summary.skippedHighRisk ?? 0),
      "Tracks: " + ((data.completedTracks ?? []).map((track) => track.id + "=" + track.status).join(" | ") || "none"),
    ].join("\\n");
  } catch {
    phase4ReadinessReady.textContent = "false";
    phase4ReadinessChecks.textContent = "0/0";
    phase4ReadinessPercent.textContent = "0";
    phase4ReadinessJson.textContent = "Unable to read Phase 4 completion readiness.";
  }
}

async function refreshPhase4Exit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-4/exit\`);
    const summary = data.summary ?? {};
    phase4ExitComplete.textContent = String(Boolean(summary.complete));
    phase4ExitPercent.textContent = String(summary.completionPercent ?? 0);
    phase4ExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-phase-5-plan";
    phase4ExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-4-exit-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Completed: " + (data.completedPhase?.completionClaim ?? "unknown"),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-phase-5-plan"),
    ].join("\\n");
  } catch {
    phase4ExitComplete.textContent = "false";
    phase4ExitPercent.textContent = "0";
    phase4ExitNext.textContent = "openclaw-phase-5-plan";
    phase4ExitJson.textContent = "Unable to read Phase 4 exit gate.";
  }
}

async function refreshPhase5Plan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-5/plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    phase5PlanReady.textContent = String(Boolean(summary.ready));
    phase5PlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-phase-5-deployment-inventory";
    phase5PlanReleaseAction.textContent = String(Boolean(governance.releaseAction));
    phase5PlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-5-plan-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown") + " ready=" + Boolean(summary.ready),
      "Theme: " + (data.whitepaperAlignment?.phaseTheme ?? "Make deployment and rollback controllable."),
      "Slices: " + ((data.selectedSlices ?? []).join(", ") || "none"),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    phase5PlanReady.textContent = "false";
    phase5PlanNext.textContent = "unknown";
    phase5PlanReleaseAction.textContent = "false";
    phase5PlanJson.textContent = "Unable to read Phase 5 plan.";
  }
}

async function refreshPhase5DeploymentInventory() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-5/deployment-inventory\`);
    const summary = data.summary ?? {};
    phase5DeploymentReady.textContent = String(Boolean(summary.ready));
    phase5DeploymentServices.textContent = String(summary.servicesObserved ?? 0);
    phase5DeploymentModules.textContent = String(summary.modulesObserved ?? 0);
    phase5DeploymentJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-5-deployment-inventory-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " checks=" + (summary.passed ?? 0) + "/" + (summary.total ?? 0),
      "Deployment: model=" + (data.deployment?.model ?? "unknown") + " profile=" + (data.deployment?.hostProfile ?? "unknown"),
      "Inventory: services=" + (summary.servicesObserved ?? 0) + " modules=" + (summary.modulesObserved ?? 0) + " scripts=" + (summary.scriptsObserved ?? 0),
    ].join("\\n");
  } catch {
    phase5DeploymentReady.textContent = "false";
    phase5DeploymentServices.textContent = "0";
    phase5DeploymentModules.textContent = "0";
    phase5DeploymentJson.textContent = "Unable to read Phase 5 deployment inventory.";
  }
}

async function refreshPhase5RollbackReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-5/rollback-readiness\`);
    const summary = data.summary ?? {};
    phase5RollbackReady.textContent = String(Boolean(summary.ready));
    phase5RollbackSurfaces.textContent = String(summary.rollbackSurfaces ?? 0);
    phase5RollbackExecuted.textContent = String(Boolean(summary.rollbackExecuted));
    phase5RollbackJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-5-rollback-readiness-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " checks=" + (summary.passed ?? 0) + "/" + (summary.total ?? 0),
      "Rollback: surfaces=" + (summary.rollbackSurfaces ?? 0) + " executed=" + Boolean(summary.rollbackExecuted),
      "Boundary: " + (data.rollback?.operatorBoundary ?? "read-only"),
    ].join("\\n");
  } catch {
    phase5RollbackReady.textContent = "false";
    phase5RollbackSurfaces.textContent = "0";
    phase5RollbackExecuted.textContent = "false";
    phase5RollbackJson.textContent = "Unable to read Phase 5 rollback readiness.";
  }
}

async function refreshPhase5ReleaseControlReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-5/release-control-readiness\`);
    const summary = data.summary ?? {};
    phase5ReleaseReady.textContent = String(Boolean(summary.ready));
    phase5ReleasePercent.textContent = String(summary.completionPercent ?? 0);
    phase5ReleaseMutation.textContent = String(Boolean(summary.mutatesHost));
    phase5ReleaseJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-5-release-control-readiness-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Controls: " + ((data.controls ?? []).join(" | ") || "none"),
      "Tracks: " + ((data.completedTracks ?? []).map((track) => track.id + "=" + track.status).join(" | ") || "none"),
    ].join("\\n");
  } catch {
    phase5ReleaseReady.textContent = "false";
    phase5ReleasePercent.textContent = "0";
    phase5ReleaseMutation.textContent = "false";
    phase5ReleaseJson.textContent = "Unable to read Phase 5 release control readiness.";
  }
}

async function refreshPhase5Exit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-5/exit\`);
    const summary = data.summary ?? {};
    phase5ExitComplete.textContent = String(Boolean(summary.complete));
    phase5ExitPercent.textContent = String(summary.completionPercent ?? 0);
    phase5ExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-mvp-final-readiness";
    phase5ExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-5-exit-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Completed: " + (data.completedPhase?.completionClaim ?? "unknown"),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-mvp-final-readiness"),
    ].join("\\n");
  } catch {
    phase5ExitComplete.textContent = "false";
    phase5ExitPercent.textContent = "0";
    phase5ExitNext.textContent = "openclaw-mvp-final-readiness";
    phase5ExitJson.textContent = "Unable to read Phase 5 exit gate.";
  }
}

async function refreshMvpFinalReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/mvp/final-readiness\`);
    const summary = data.summary ?? {};
    mvpFinalComplete.textContent = String(Boolean(summary.complete));
    mvpFinalCriteria.textContent = (summary.criteriaPassed ?? 0) + "/" + (summary.criteriaTotal ?? 0);
    mvpFinalNext.textContent = data.next?.recommendedSlice ?? "openclaw-post-mvp-plan";
    mvpFinalJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-mvp-final-readiness-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Criteria: " + (summary.criteriaPassed ?? 0) + "/" + (summary.criteriaTotal ?? 0),
      "Boundary: " + (data.whitepaperAlignment?.nextBoundary ?? "post-MVP plan required"),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-post-mvp-plan"),
    ].join("\\n");
  } catch {
    mvpFinalComplete.textContent = "false";
    mvpFinalCriteria.textContent = "0/0";
    mvpFinalNext.textContent = "openclaw-post-mvp-plan";
    mvpFinalJson.textContent = "Unable to read MVP final readiness.";
  }
}

async function refreshPostMvpPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/post-mvp/plan\`);
    const summary = data.summary ?? {};
    postMvpPlanReady.textContent = String(Boolean(summary.ready));
    postMvpPlanTrunk.textContent = summary.selectedTrunk ?? "unknown";
    postMvpPlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-phase-6-consciousness-memory-plan";
    postMvpPlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-post-mvp-plan-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Theme: " + (data.whitepaperAlignment?.selectedTheme ?? "Give the body a memory-bearing task mind."),
      "Selected: " + (summary.selectedTrunk ?? "unknown"),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-phase-6-consciousness-memory-plan"),
    ].join("\\n");
  } catch {
    postMvpPlanReady.textContent = "false";
    postMvpPlanTrunk.textContent = "unknown";
    postMvpPlanNext.textContent = "openclaw-phase-6-consciousness-memory-plan";
    postMvpPlanJson.textContent = "Unable to read post-MVP plan.";
  }
}

`;
