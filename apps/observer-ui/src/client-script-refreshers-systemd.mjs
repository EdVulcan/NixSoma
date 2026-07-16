export const observerClientSystemdRefreshersScript = `async function refreshPhase2RouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/phase-2-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    phase2RouteSelectedTrack.textContent = decision.selectedTrack ?? "unknown";
    phase2RouteNextSlice.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    phase2RouteCreatesTask.textContent = String(Boolean(governance.createsTask));
    phase2RouteMutation.textContent = String(Boolean(governance.hostMutation));
    phase2RouteJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: trackCReady=\${Boolean(evidence.trackCReady)} checks=\${evidence.trackCChecks ?? "0/0"} completed=\${evidence.completedTrack?.completionClaim ?? "unknown"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.track}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "demo control room"}\`,
    ].join("\\n");
  } catch {
    phase2RouteSelectedTrack.textContent = "offline";
    phase2RouteNextSlice.textContent = "unknown";
    phase2RouteCreatesTask.textContent = "false";
    phase2RouteMutation.textContent = "false";
    phase2RouteJson.textContent = "Unable to read Phase 2 route review.";
  }
}

async function refreshSystemdRepairCandidates() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidates\`);
    const governance = data.governance ?? {};
    const summary = data.summary ?? {};
    const candidates = data.candidates ?? [];
    systemdRepairCandidateCount.textContent = String(summary.totalCandidates ?? candidates.length);
    systemdRepairCandidateRecommended.textContent = summary.recommendedUnit ?? "unknown";
    systemdRepairCandidateCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdRepairCandidateMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Summary: total=\${summary.totalCandidates ?? 0} degraded=\${summary.degradedCandidates ?? 0} demoTargets=\${summary.existingDemoTargets ?? 0} highImpact=\${summary.highImpactCandidates ?? 0}\`,
      \`Recommended: \${summary.recommendedUnit ?? "none"} reason=\${summary.recommendedReason ?? "none"}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.unit}:score=\${candidate.assessment?.score ?? 0}:demo=\${Boolean(candidate.assessment?.existingDemoTarget)}:degraded=\${Boolean(candidate.assessment?.degraded)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "repair candidate plan"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateCount.textContent = "0";
    systemdRepairCandidateRecommended.textContent = "offline";
    systemdRepairCandidateCreatesTask.textContent = "false";
    systemdRepairCandidateMutation.textContent = "false";
    systemdRepairCandidateJson.textContent = "Unable to read systemd repair candidate assessment.";
  }
}

async function refreshSystemdRepairCandidatePlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-plan\`);
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const selected = data.selectedCandidate ?? {};
    systemdRepairCandidatePlanTarget.textContent = plan.targetUnit ?? selected.unit ?? "unknown";
    systemdRepairCandidatePlanMode.textContent = data.mode ?? "plan_only";
    systemdRepairCandidatePlanCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdRepairCandidatePlanMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidatePlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Selected: \${selected.unit ?? "none"} score=\${selected.score ?? 0} demoTarget=\${Boolean(selected.existingDemoTarget)} degraded=\${Boolean(selected.degraded)}\`,
      \`Plan: intent=\${plan.intent ?? "unknown"} target=\${plan.targetUnit ?? "none"} previewOnly=\${Boolean(plan.commandPreviewOnly)} command=\${plan.commandPreview ?? "none"}\`,
      \`Steps: \${(plan.steps ?? []).map((step) => \`\${step.id}=\${step.status}\`).join(", ")}\`,
      \`Required: \${(plan.requiredBeforeExecution ?? []).join(", ") || "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "observer candidate plan"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidatePlanTarget.textContent = "offline";
    systemdRepairCandidatePlanMode.textContent = "plan_only";
    systemdRepairCandidatePlanCreatesTask.textContent = "false";
    systemdRepairCandidatePlanMutation.textContent = "false";
    systemdRepairCandidatePlanJson.textContent = "Unable to read systemd repair candidate plan.";
  }
}

async function refreshSystemdRepairCandidateRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-task-route\`);
    const governance = data.governance ?? {};
    const decision = data.routeDecision ?? {};
    systemdRepairCandidateRouteStatus.textContent = decision.status ?? "unknown";
    systemdRepairCandidateRouteTarget.textContent = decision.targetUnit ?? "unknown";
    systemdRepairCandidateRouteCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdRepairCandidateRouteMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateRouteJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Decision: status=\${decision.status ?? "unknown"} target=\${decision.targetUnit ?? "none"} existingRoute=\${decision.existingRoute ?? "none"} available=\${Boolean(decision.existingRouteAvailable)}\`,
      \`Reason: \${decision.reason ?? "none"}\`,
      \`Required: \${(data.requiredBeforeTaskCreation ?? []).join(", ") || "none"}\`,
      \`Allowed Next: \${(data.allowedNextActions ?? []).map((action) => \`\${action.id}:allowed=\${Boolean(action.allowedNow)} createsTask=\${Boolean(action.createsTask)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "candidate task shell"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateRouteStatus.textContent = "offline";
    systemdRepairCandidateRouteTarget.textContent = "offline";
    systemdRepairCandidateRouteCreatesTask.textContent = "false";
    systemdRepairCandidateRouteMutation.textContent = "false";
    systemdRepairCandidateRouteJson.textContent = "Unable to read repair candidate task route gate.";
  }
}

async function refreshSystemdRepairCandidateTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-task-route\`);
    const governance = data.governance ?? {};
    const decision = data.routeDecision ?? {};
    const ready = decision.existingRouteAvailable === true
      && decision.targetUnit === "openclaw-browser-runtime.service";
    systemdRepairCandidateTaskShellReady.textContent = String(ready);
    systemdRepairCandidateTaskShellTarget.textContent = decision.targetUnit ?? "unknown";
    systemdRepairCandidateTaskShellApproval.textContent = ready ? "pending-after-create" : "route-blocked";
    systemdRepairCandidateTaskShellMutation.textContent = "false";
    systemdRepairCandidateTaskShellJson.textContent = [
      "Registry: openclaw-systemd-repair-candidate-task-shell-v0",
      \`Source Route: \${data.registry ?? "unknown"}\`,
      \`Mode: approval-gated-candidate-task-shell ready=\${ready}\`,
      \`Target: \${decision.targetUnit ?? "none"} existingRoute=\${decision.existingRoute ?? "none"} available=\${Boolean(decision.existingRouteAvailable)}\`,
      \`Approval: creates pending high-risk approval only after explicit button click\`,
      \`Governance: createsTaskOnClick=true mutation=false executed=false hostMutation=false routeMutation=\${Boolean(governance.hostMutation)}\`,
      "Endpoint: /system/systemd/repair-candidate-tasks",
    ].join("\\n");
  } catch {
    systemdRepairCandidateTaskShellReady.textContent = "false";
    systemdRepairCandidateTaskShellTarget.textContent = "offline";
    systemdRepairCandidateTaskShellApproval.textContent = "route-blocked";
    systemdRepairCandidateTaskShellMutation.textContent = "false";
    systemdRepairCandidateTaskShellJson.textContent = "Unable to read repair candidate task shell boundary.";
  }
}

async function refreshSystemdRepairCandidateReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checks = Array.isArray(data.checks) ? data.checks : [];
    const nextSlice = data.next?.recommendedSlice ?? "openclaw-systemd-repair-candidate-route-review";
    systemdRepairCandidateReadinessReady.textContent = String(Boolean(summary.ready));
    systemdRepairCandidateReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checks.length}\`;
    systemdRepairCandidateReadinessNext.textContent = nextSlice;
    systemdRepairCandidateReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.ready)} selectedUnit=\${summary.selectedUnit ?? "unknown"}\`,
      \`Checks: \${checks.map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Completed: \${data.completedBlock?.completionClaim ?? "unknown"} slices=\${(data.completedBlock?.completedSlices ?? []).length}\`,
      \`Evidence: candidate=\${data.evidence?.recommendedCandidate ?? "none"} route=\${data.evidence?.routeStatus ?? "unknown"} command=\${data.evidence?.commandPreview ?? "none"}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Next: \${nextSlice} boundary=\${data.next?.boundary ?? "whitepaper route review"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateReadinessReady.textContent = "false";
    systemdRepairCandidateReadinessChecks.textContent = "0/0";
    systemdRepairCandidateReadinessNext.textContent = "offline";
    systemdRepairCandidateReadinessMutation.textContent = "false";
    systemdRepairCandidateReadinessJson.textContent = "Unable to read repair candidate block readiness.";
  }
}

async function refreshSystemdRepairCandidateRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-route-review\`);
    const decision = data.decision ?? {};
    const governance = data.governance ?? {};
    const evidence = data.evidence ?? {};
    systemdRepairCandidateRouteReviewTrack.textContent = decision.selectedTrack ?? "unknown";
    systemdRepairCandidateRouteReviewSlice.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    systemdRepairCandidateRouteReviewCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdRepairCandidateRouteReviewMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: candidateReady=\${Boolean(evidence.candidateReady)} checks=\${evidence.candidateChecks ?? "0/0"} selectedUnit=\${evidence.selectedUnit ?? "unknown"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.track}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-repair-candidate-demo-status"} boundary=\${data.next?.boundary ?? "read-only demo status"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateRouteReviewTrack.textContent = "offline";
    systemdRepairCandidateRouteReviewSlice.textContent = "offline";
    systemdRepairCandidateRouteReviewCreatesTask.textContent = "false";
    systemdRepairCandidateRouteReviewMutation.textContent = "false";
    systemdRepairCandidateRouteReviewJson.textContent = "Unable to read repair candidate route review.";
  }
}

async function refreshSystemdRepairCandidateDemoStatus() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-demo-status\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const operatorView = data.operatorView ?? {};
    systemdRepairCandidateDemoStatusReady.textContent = String(Boolean(summary.demoReady));
    systemdRepairCandidateDemoStatusChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? 0}\`;
    systemdRepairCandidateDemoStatusTarget.textContent = summary.selectedUnit ?? "unknown";
    systemdRepairCandidateDemoStatusMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateDemoStatusJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} demoReady=\${Boolean(summary.demoReady)} target=\${summary.selectedUnit ?? "unknown"} hiddenMutation=\${Boolean(summary.hiddenMutation)}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Checklist: \${(data.checklist ?? []).map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Narrative: \${operatorView.narrative ?? "none"}\`,
      \`Speaking: \${(operatorView.speakingPoints ?? []).join(" | ")}\`,
      \`Evidence: candidate=\${data.evidence?.recommendedCandidate ?? "none"} route=\${data.evidence?.routeStatus ?? "unknown"} command=\${data.evidence?.commandPreview ?? "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "whitepaper route review"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateDemoStatusReady.textContent = "false";
    systemdRepairCandidateDemoStatusChecks.textContent = "0/0";
    systemdRepairCandidateDemoStatusTarget.textContent = "offline";
    systemdRepairCandidateDemoStatusMutation.textContent = "false";
    systemdRepairCandidateDemoStatusJson.textContent = "Unable to read repair candidate demo status.";
  }
}

async function refreshSystemdNextRepairScopeReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-scope-review\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    systemdNextRepairScopeReviewReady.textContent = String(Boolean(summary.ready));
    systemdNextRepairScopeReviewUnit.textContent = summary.selectedUnit ?? decision.selectedUnit ?? "unknown";
    systemdNextRepairScopeReviewCandidates.textContent = String(summary.candidateCount ?? data.candidates?.length ?? 0);
    systemdNextRepairScopeReviewMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairScopeReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"} unit=\${decision.selectedUnit ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: ledgerDemoReady=\${Boolean(summary.ledgerDemoReady)} ledgerRegistry=\${evidence.ledgerDemo?.registry ?? "unknown"} recordCount=\${evidence.ledgerDemo?.recordCount ?? 0} completedDemoUnit=\${summary.completedDemoUnit ?? "unknown"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.unit}:score=\${candidate.score}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-plan"} boundary=\${data.next?.boundary ?? "plan-only repair scope"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairScopeReviewReady.textContent = "false";
    systemdNextRepairScopeReviewUnit.textContent = "offline";
    systemdNextRepairScopeReviewCandidates.textContent = "0";
    systemdNextRepairScopeReviewMutation.textContent = "false";
    systemdNextRepairScopeReviewJson.textContent = "Unable to read next repair scope review.";
  }
}

async function refreshSystemdNextRepairPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-plan\`);
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const scope = data.scope ?? {};
    systemdNextRepairPlanTarget.textContent = plan.targetUnit ?? data.target?.unit ?? "unknown";
    systemdNextRepairPlanMode.textContent = data.mode ?? "plan_only";
    systemdNextRepairPlanCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdNextRepairPlanMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Scope: ready=\${Boolean(scope.scopeReady)} ledgerDemoReady=\${Boolean(scope.ledgerDemoReady)} completedDemoUnit=\${scope.completedDemoUnit ?? "unknown"}\`,
      \`Target: \${plan.targetUnit ?? "unknown"} impact=\${data.target?.impactClass ?? "unknown"} radius=\${data.target?.impactRadius ?? 0}\`,
      \`Command preview: \${plan.commandPreview ?? "none"} previewOnly=\${Boolean(plan.commandPreviewOnly)} restartsService=\${Boolean(plan.restartsService)}\`,
      \`Reason: \${plan.reason ?? "none"}\`,
      \`Required: \${(plan.requiredBeforeExecution ?? []).join(", ") || "none"}\`,
      \`Avoid: \${(plan.notSelected ?? []).join(", ") || "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-route-review"} boundary=\${data.next?.boundary ?? "route review before mutation"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairPlanTarget.textContent = "offline";
    systemdNextRepairPlanMode.textContent = "offline";
    systemdNextRepairPlanCreatesTask.textContent = "false";
    systemdNextRepairPlanMutation.textContent = "false";
    systemdNextRepairPlanJson.textContent = "Unable to read next repair plan.";
  }
}

async function refreshSystemdNextRepairRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    systemdNextRepairRouteReviewTrack.textContent = decision.selectedTrack ?? "unknown";
    systemdNextRepairRouteReviewSlice.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    systemdNextRepairRouteReviewCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdNextRepairRouteReviewMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"} unit=\${decision.selectedUnit ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: planReady=\${Boolean(evidence.planReady)} target=\${evidence.targetUnit ?? "unknown"} previewOnly=\${Boolean(evidence.commandPreviewOnly)} command=\${evidence.commandPreview ?? "none"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.track}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-dry-run"} boundary=\${data.next?.boundary ?? "dry-run envelope only"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairRouteReviewTrack.textContent = "offline";
    systemdNextRepairRouteReviewSlice.textContent = "offline";
    systemdNextRepairRouteReviewCreatesTask.textContent = "false";
    systemdNextRepairRouteReviewMutation.textContent = "false";
    systemdNextRepairRouteReviewJson.textContent = "Unable to read next repair route review.";
  }
}

async function refreshSystemdNextRepairDryRun() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-dry-run\`);
    const governance = data.governance ?? {};
    const dryRun = data.dryRun ?? {};
    systemdNextRepairDryRunTarget.textContent = data.target?.unit ?? data.plan?.plan?.targetUnit ?? "unknown";
    systemdNextRepairDryRunMode.textContent = data.mode ?? "dry_run";
    systemdNextRepairDryRunWouldExecute.textContent = String(Boolean(dryRun.wouldExecute));
    systemdNextRepairDryRunMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairDryRunJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} wouldExecute=\${Boolean(data.wouldExecute)} canRestart=\${Boolean(data.canRestart)} mutation=\${Boolean(governance.hostMutation)} executesCommand=\${Boolean(governance.executesCommand)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)}\`,
      \`Route: \${data.routeReview?.status ?? "unknown"} selected=\${data.routeReview?.selectedSlice ?? "unknown"} unit=\${data.routeReview?.selectedUnit ?? "unknown"}\`,
      \`Target: \${data.target?.unit ?? "unknown"} impact=\${data.target?.impactClass ?? "unknown"} radius=\${data.target?.impactRadius ?? 0}\`,
      \`Command: \${dryRun.command ?? "none"} \${(dryRun.args ?? []).join(" ")} risk=\${dryRun.risk ?? "unknown"} requiresApproval=\${Boolean(dryRun.requiresApproval)} wouldExecute=\${Boolean(dryRun.wouldExecute)}\`,
      "Expected checks: no_execution, route_review_selected_dry_run, target_is_system_sense, operator_visible_before_mutation, no_restart_executed",
      \`Checks: \${(dryRun.checks ?? []).map((check) => \`\${check.name}=\${Boolean(check.passed)}\`).join(", ") || "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-task-route"} boundary=\${data.next?.boundary ?? "route-review task materialization"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairDryRunTarget.textContent = "offline";
    systemdNextRepairDryRunMode.textContent = "offline";
    systemdNextRepairDryRunWouldExecute.textContent = "false";
    systemdNextRepairDryRunMutation.textContent = "false";
    systemdNextRepairDryRunJson.textContent = "Unable to read next repair dry-run envelope.";
  }
}

async function refreshSystemdNextRepairTaskRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-task-route\`);
    const governance = data.governance ?? {};
    const routeDecision = data.routeDecision ?? {};
    const evidence = data.evidence ?? {};
    systemdNextRepairTaskRouteStatus.textContent = routeDecision.status ?? "unknown";
    systemdNextRepairTaskRouteSlice.textContent = routeDecision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    systemdNextRepairTaskRouteCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdNextRepairTaskRouteMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairTaskRouteJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Route: \${routeDecision.status ?? "unknown"} selected=\${routeDecision.selectedSlice ?? "unknown"} target=\${routeDecision.targetUnit ?? "unknown"} taskShellAllowed=\${Boolean(routeDecision.taskShellAllowed)}\`,
      \`Reason: \${routeDecision.reason ?? "none"}\`,
      \`Required: \${(data.requiredBeforeTaskCreation ?? []).join(", ") || "none"}\`,
      \`Evidence: dryRunReady=\${Boolean(evidence.dryRunReady)} command=\${evidence.command ?? "none"} \${(evidence.args ?? []).join(" ")} wouldExecute=\${Boolean(evidence.wouldExecute)}\`,
      \`Actions: \${(data.allowedNextActions ?? []).map((action) => \`\${action.id}:allowed=\${Boolean(action.allowedNow)}:createsTask=\${Boolean(action.createsTask)}:mutation=\${Boolean(action.mutatesHost)}\`).join(", ") || "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-task-shell"} boundary=\${data.next?.boundary ?? "task shell only"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairTaskRouteStatus.textContent = "offline";
    systemdNextRepairTaskRouteSlice.textContent = "offline";
    systemdNextRepairTaskRouteCreatesTask.textContent = "false";
    systemdNextRepairTaskRouteMutation.textContent = "false";
    systemdNextRepairTaskRouteJson.textContent = "Unable to read next repair task route.";
  }
}

async function refreshSystemdNextRepairTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-task-route\`);
    const governance = data.governance ?? {};
    const routeDecision = data.routeDecision ?? {};
    const createShell = data.allowedNextActions?.find((action) => action.id === "create-task-shell") ?? {};
    systemdNextRepairTaskShellReady.textContent = String(Boolean(routeDecision.taskShellAllowed));
    systemdNextRepairTaskShellTarget.textContent = routeDecision.targetUnit ?? "openclaw-system-sense.service";
    systemdNextRepairTaskShellApproval.textContent = createShell.createsApproval === true ? "pending-after-create" : "unavailable";
    systemdNextRepairTaskShellMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairTaskShellJson.textContent = [
      "Registry: openclaw-systemd-next-repair-task-shell-v0",
      "Real Execution Registry: openclaw-systemd-next-repair-real-execution-v0",
      "Endpoint: /system/systemd/next-repair-tasks",
      \`Route: \${data.registry ?? "unknown"} selected=\${routeDecision.selectedSlice ?? "unknown"} target=\${routeDecision.targetUnit ?? "unknown"}\`,
      \`Create: allowed=\${Boolean(createShell.allowedNow)} createsTask=\${Boolean(createShell.createsTask)} createsApproval=\${Boolean(createShell.createsApproval)} approvalState=pending-after-create\`,
      \`Boundary: executed=false hostMutation=\${Boolean(governance.hostMutation)} realExecutionEnabled=false\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-task-shell"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairTaskShellReady.textContent = "false";
    systemdNextRepairTaskShellTarget.textContent = "offline";
    systemdNextRepairTaskShellApproval.textContent = "unavailable";
    systemdNextRepairTaskShellMutation.textContent = "false";
    systemdNextRepairTaskShellJson.textContent = "Unable to read next repair task shell route.";
  }
}

async function refreshSystemdUnitInventory() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/units\`);
    const summary = data.summary ?? {};
    const source = data.source ?? {};
    const governance = data.governance ?? {};
    const units = Array.isArray(data.units) ? data.units : [];
    systemdUnitTotal.textContent = String(summary.total ?? units.length);
    systemdUnitActive.textContent = String(summary.active ?? 0);
    systemdUnitObserved.textContent = String(summary.observed ?? 0);
    systemdUnitMode.textContent = data.mode ?? "read_only";
    systemdUnitJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canMutate=\${Boolean(data.canMutate)} canRestart=\${Boolean(data.canRestart)}\`,
      \`Systemd: \${source.systemdAvailable ? source.systemdVersion ?? "available" : source.unavailableReason ?? "unavailable"}\`,
      \`Governance: \${governance.autonomy ?? "observe_only"} domain=\${governance.domain ?? "body_internal"} mutation=\${Boolean(governance.hostMutation)}\`,
      "Manager scope: configured=" + String(summary.managerScopeConfigured ?? 0)
        + " matched=" + String(summary.managerScopeMatched ?? 0)
        + " mismatches=" + String(summary.managerScopeMismatches ?? 0)
        + " unresolved=" + String(summary.managerScopeUnresolved ?? 0),
      \`Units: \${units.map((unit) => \`\${unit.unit}:\${unit.activeState ?? unit.status ?? "unknown"}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "plan-only repair proposal"}\`,
    ].join("\\n");
  } catch {
    systemdUnitTotal.textContent = "0";
    systemdUnitActive.textContent = "0";
    systemdUnitObserved.textContent = "0";
    systemdUnitMode.textContent = "offline";
    systemdUnitJson.textContent = "Unable to read OpenClaw systemd unit inventory.";
  }
}

async function refreshSystemdDependencyMap() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/dependency-map\`);
    const summary = data.summary ?? {};
    const source = data.source ?? {};
    const governance = data.governance ?? {};
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    const edges = Array.isArray(data.edges) ? data.edges : [];
    const highImpact = nodes
      .filter((node) => node.impactClass === "foundational" || node.impactClass === "high")
      .map((node) => \`\${node.unit}:\${node.impactRadius ?? 0}\`);
    systemdDependencyNodeCount.textContent = String(summary.nodes ?? nodes.length);
    systemdDependencyEdgeCount.textContent = String(summary.edges ?? edges.length);
    systemdDependencyRootCount.textContent = String(summary.roots ?? data.roots?.length ?? 0);
    systemdDependencyHighImpact.textContent = String(summary.highImpact ?? highImpact.length);
    systemdDependencyJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Roots: \${(data.roots ?? []).join(", ") || "none"}\`,
      \`Leaves: \${(data.leaves ?? []).join(", ") || "none"}\`,
      \`High impact: \${highImpact.join(", ") || "none"}\`,
      "Dependency evidence: " + String(source.dependencyEvidence ?? "planned")
        + " observedNodes=" + String(summary.observedDependencyNodes ?? 0)
        + " observedEdges=" + String(summary.observedEdges ?? 0)
        + " driftNodes=" + String(summary.dependencyDriftNodes ?? 0),
      "Observed edges: " + ((data.observedEdges ?? [])
        .map((edge) => String(edge.from) + "->" + String(edge.to)).join(", ") || "none"),
      \`Layers: \${Object.entries(data.startupLayers ?? {}).map(([layer, units]) => \`\${layer}=[\${units.join(", ")}]\`).join(" ")}\`,
      \`Edges: \${edges.map((edge) => \`\${edge.from}->\${edge.to}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "health trend summary"}\`,
    ].join("\\n");
  } catch {
    systemdDependencyNodeCount.textContent = "0";
    systemdDependencyEdgeCount.textContent = "0";
    systemdDependencyRootCount.textContent = "0";
    systemdDependencyHighImpact.textContent = "0";
    systemdDependencyJson.textContent = "Unable to read OpenClaw body dependency map.";
  }
}

async function refreshSystemdRepairPlan() {
  try {
    const [plan, dryRun] = await Promise.all([
      fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-plan?unit=openclaw-browser-runtime.service\`),
      fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-dry-run?unit=openclaw-browser-runtime.service\`),
    ]);
    const proposal = plan.proposal ?? {};
    const target = plan.target ?? {};
    systemdRepairPlanTarget.textContent = target.unit ?? "unknown";
    systemdRepairPlanRisk.textContent = proposal.risk ?? "unknown";
    systemdRepairPlanMode.textContent = plan.mode ?? "plan_only";
    systemdRepairDryRunMode.textContent = dryRun.mode ?? "operator_visible_dry_run";
    systemdRepairPlanJson.textContent = [
      \`Registry: \${plan.registry ?? "unknown"}\`,
      \`Target: \${target.unit ?? "unknown"} state=\${target.activeState ?? "unknown"}/\${target.subState ?? "unknown"}\`,
      \`Command: \${proposal.command?.command ?? "systemctl"} \${(proposal.command?.args ?? []).join(" ")}\`,
      \`Risk: \${proposal.risk ?? "unknown"} approvalForExecution=\${Boolean(proposal.approvalRequiredForExecution)}\`,
      \`Reason: \${proposal.reason ?? "none"}\`,
      \`Rollback: \${proposal.rollbackNote ?? "none"}\`,
    ].join("\\n");
    systemdRepairDryRunJson.textContent = [
      \`Registry: \${dryRun.registry ?? "unknown"}\`,
      \`Mode: \${dryRun.mode ?? "unknown"} wouldExecute=\${Boolean(dryRun.wouldExecute)} canRestart=\${Boolean(dryRun.canRestart)}\`,
      \`Dry Run: \${dryRun.dryRun?.command ?? "systemctl"} \${(dryRun.dryRun?.args ?? []).join(" ")}\`,
      \`Governance: \${dryRun.governance?.autonomy ?? "dry_run_only"} mutation=\${Boolean(dryRun.governance?.hostMutation)}\`,
      \`Checks: \${(dryRun.dryRun?.checks ?? []).map((check) => \`\${check.name}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Next: \${dryRun.next?.recommendedSlice ?? "separate route review required"}\`,
    ].join("\\n");
  } catch {
    systemdRepairPlanTarget.textContent = "offline";
    systemdRepairPlanRisk.textContent = "unknown";
    systemdRepairPlanMode.textContent = "offline";
    systemdRepairDryRunMode.textContent = "offline";
    systemdRepairPlanJson.textContent = "Unable to read OpenClaw systemd repair plan.";
    systemdRepairDryRunJson.textContent = "Unable to read OpenClaw systemd repair dry-run envelope.";
  }
}

async function refreshSystemdRepairExecutionTaskDraft() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/repair-execution-task-draft?unit=openclaw-browser-runtime.service\`);
    const draft = data.draft ?? {};
    const systemdRepair = draft.systemdRepair ?? {};
    systemdRepairExecutionTaskRegistry.textContent = data.registry ?? "openclaw-systemd-repair-execution-task-v0";
    systemdRepairExecutionTaskTarget.textContent = data.target?.unit ?? systemdRepair.target?.unit ?? "unknown";
    systemdRepairExecutionTaskApproval.textContent = draft.policy?.decision?.decision === "require_approval" ? "required" : "unknown";
    systemdRepairExecutionTaskExecuted.textContent = String(Boolean(systemdRepair.execution?.executed));
    systemdRepairExecutionTaskJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"}\`,
      \`Target: \${data.target?.unit ?? "unknown"}\`,
      \`Policy: \${draft.policy?.decision?.decision ?? "unknown"} risk=\${draft.policy?.decision?.risk ?? "unknown"}\`,
      \`Command: \${systemdRepair.command?.command ?? "systemctl"} \${(systemdRepair.command?.args ?? []).join(" ")}\`,
      \`Evidence: inventory=\${systemdRepair.inventoryRegistry ?? "unknown"} plan=\${systemdRepair.planRegistry ?? "unknown"} dryRun=\${systemdRepair.sourceRegistry ?? "unknown"}\`,
      \`Execution: shellOnly=\${Boolean(systemdRepair.execution?.shellOnly)} realExecutionEnabled=\${Boolean(systemdRepair.execution?.realExecutionEnabled)} executed=\${Boolean(systemdRepair.execution?.executed)} hostMutation=\${Boolean(systemdRepair.execution?.hostMutation)} hostMutationAttempted=\${Boolean(systemdRepair.execution?.hostMutationAttempted)}\`,
      \`Real execution unit: \${systemdRepair.execution?.selectedRealExecutionUnit ?? "not-enabled"}\`,
    ].join("\\n");
  } catch {
    systemdRepairExecutionTaskRegistry.textContent = "offline";
    systemdRepairExecutionTaskTarget.textContent = "offline";
    systemdRepairExecutionTaskApproval.textContent = "unknown";
    systemdRepairExecutionTaskExecuted.textContent = "false";
    systemdRepairExecutionTaskJson.textContent = "Unable to read OpenClaw systemd repair execution task draft.";
  }
}

`;
