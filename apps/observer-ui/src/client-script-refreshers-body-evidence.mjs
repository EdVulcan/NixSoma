export const observerClientBodyEvidenceRefreshersScript = `async function refreshHealthTrends() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/health/trends\`);
    const summary = data.summary ?? {};
    const resources = data.resources ?? {};
    const services = Array.isArray(data.services) ? data.services : [];
    healthTrendSampleCount.textContent = String(summary.sampleCount ?? 0);
    healthTrendStableServices.textContent = String(summary.stableServices ?? 0);
    healthTrendDegradedServices.textContent = String(summary.degradedServices ?? 0);
    healthTrendAlertCount.textContent = String(summary.latestAlertCount ?? 0);
    healthTrendJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(data.governance?.hostMutation)} recovery=\${Boolean(data.governance?.triggersRecovery)}\`,
      \`Window: \${summary.windowStart ?? "none"} -> \${summary.windowEnd ?? "none"} samples=\${summary.sampleCount ?? 0}\`,
      \`Services: online=\${summary.latestOnlineServices ?? 0}/\${summary.latestTotalServices ?? 0} stable=\${summary.stableServices ?? 0} degraded=\${summary.degradedServices ?? 0}\`,
      \`Resources: cpu=\${resources.cpuPercent?.latest ?? "n/a"}% memory=\${resources.memoryPercent?.latest ?? "n/a"}% disk=\${resources.diskPercent?.latest ?? "n/a"}%\`,
      \`Service trends: \${services.map((service) => \`\${service.service}:\${service.latestStatus}/offline=\${service.offline}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "route-aware recommendation"}\`,
    ].join("\\n");
  } catch {
    healthTrendSampleCount.textContent = "0";
    healthTrendStableServices.textContent = "0";
    healthTrendDegradedServices.textContent = "0";
    healthTrendAlertCount.textContent = "0";
    healthTrendJson.textContent = "Unable to read OpenClaw health trend summary.";
  }
}

async function refreshRouteAwareNextAction() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/next-action\`);
    const recommendation = data.recommendation ?? {};
    const governance = data.governance ?? {};
    const evidence = data.evidence ?? {};
    routeNextActionName.textContent = recommendation.action ?? "unknown";
    routeNextActionPriority.textContent = recommendation.priority ?? "unknown";
    routeNextActionCreatesTask.textContent = String(Boolean(governance.createsTask));
    routeNextActionMutation.textContent = String(Boolean(governance.hostMutation));
    routeNextActionJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Recommendation: \${recommendation.action ?? "unknown"} priority=\${recommendation.priority ?? "unknown"}\`,
      \`Reason: \${recommendation.reason ?? "none"}\`,
      \`Targets: \${(recommendation.targets ?? []).join(", ") || "none"}\`,
      \`Evidence: dependencyNodes=\${evidence.dependency?.nodes ?? 0} highImpact=\${evidence.dependency?.highImpact ?? 0} healthSamples=\${evidence.health?.samples ?? 0} degraded=\${evidence.health?.degradedServices ?? 0}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.id}:allowed=\${Boolean(candidate.allowedNow)} mutation=\${Boolean(candidate.mutation)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "policy explanation"}\`,
    ].join("\\n");
  } catch {
    routeNextActionName.textContent = "offline";
    routeNextActionPriority.textContent = "unknown";
    routeNextActionCreatesTask.textContent = "false";
    routeNextActionMutation.textContent = "false";
    routeNextActionJson.textContent = "Unable to read route-aware next-action recommendation.";
  }
}

async function refreshConservativeRecoveryPolicy() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/recovery-policy\`);
    const governance = data.governance ?? {};
    const policy = data.policy ?? {};
    const routeState = data.routeState ?? {};
    const hardBoundaries = data.hardBoundaries ?? {};
    recoveryPolicyPosture.textContent = policy.currentPosture ?? "unknown";
    recoveryPolicyCreatesTask.textContent = String(Boolean(governance.createsTask));
    recoveryPolicyExecutesCommand.textContent = String(Boolean(governance.executesCommand));
    recoveryPolicyMutation.textContent = String(Boolean(governance.hostMutation));
    recoveryPolicyJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)}\`,
      \`Policy: \${policy.name ?? "unknown"} posture=\${policy.currentPosture ?? "unknown"}\`,
      \`Reason: \${policy.currentReason ?? "none"}\`,
      \`Route: action=\${routeState.action ?? "unknown"} priority=\${routeState.priority ?? "unknown"} degraded=\${routeState.degradedServices ?? 0} alerts=\${routeState.latestAlertCount ?? 0}\`,
      \`Evidence: dependencyNodes=\${routeState.dependencyNodes ?? 0} highImpact=\${routeState.highImpactNodes ?? 0} healthSamples=\${routeState.healthSamples ?? 0}\`,
      \`Rules: \${(data.rules ?? []).map((rule) => \`\${rule.id}:mutation=\${Boolean(rule.mutation)} createsTask=\${Boolean(rule.createsTask)}\`).join(", ")}\`,
      \`Boundaries: noTask=\${Boolean(hardBoundaries.noTaskCreation)} noCommand=\${Boolean(hardBoundaries.noCommandExecution)} noMutation=\${Boolean(hardBoundaries.noHostMutation)} noScheduler=\${Boolean(hardBoundaries.noScheduler)}\`,
      \`Next: \${data.next?.recommendedSlice ?? "body governance readiness"}\`,
    ].join("\\n");
  } catch {
    recoveryPolicyPosture.textContent = "offline";
    recoveryPolicyCreatesTask.textContent = "false";
    recoveryPolicyExecutesCommand.textContent = "false";
    recoveryPolicyMutation.textContent = "false";
    recoveryPolicyJson.textContent = "Unable to read conservative recovery policy explanation.";
  }
}

async function refreshBodyGovernanceReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-governance-readiness\`);
    const governance = data.governance ?? {};
    const summary = data.summary ?? {};
    const evidence = data.evidence ?? {};
    const completedTrack = data.completedTrack ?? {};
    bodyGovernanceReady.textContent = String(Boolean(summary.ready));
    bodyGovernanceChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? 0}\`;
    bodyGovernancePosture.textContent = summary.currentPosture ?? "unknown";
    bodyGovernanceMutation.textContent = String(Boolean(governance.hostMutation));
    bodyGovernanceJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.ready)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)}\`,
      \`Checks: \${summary.passedChecks ?? 0}/\${summary.totalChecks ?? 0} posture=\${summary.currentPosture ?? "unknown"} action=\${summary.routeAction ?? "unknown"} priority=\${summary.routePriority ?? "unknown"}\`,
      \`Evidence: dependencyNodes=\${evidence.dependencyNodes ?? 0} highImpact=\${evidence.highImpactNodes ?? 0} healthSamples=\${evidence.healthSamples ?? 0} policyRules=\${evidence.policyRules ?? 0}\`,
      \`Completed: \${completedTrack.name ?? "unknown"} claim=\${completedTrack.completionClaim ?? "unknown"}\`,
      \`Slices: \${(completedTrack.completedSlices ?? []).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "phase 2 route review"}\`,
    ].join("\\n");
  } catch {
    bodyGovernanceReady.textContent = "false";
    bodyGovernanceChecks.textContent = "0/0";
    bodyGovernancePosture.textContent = "offline";
    bodyGovernanceMutation.textContent = "false";
    bodyGovernanceJson.textContent = "Unable to read body governance readiness bundle.";
  }
}

async function refreshBodyEvidenceTimeline() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-timeline\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const memory = data.memoryModel ?? {};
    bodyEvidenceTimelineReady.textContent = String(Boolean(summary.timelineReady));
    bodyEvidenceTimelineEntries.textContent = String(summary.entries ?? entries.length);
    bodyEvidenceTimelineLatest.textContent = summary.latestEntryId ?? "unknown";
    bodyEvidenceTimelineMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceTimelineJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.timelineReady)} entries=\${summary.entries ?? entries.length} phases=\${(summary.phases ?? []).join(",")}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Latest: \${summary.latestEntryId ?? "none"} registry=\${summary.latestRegistry ?? "none"} candidateDemoReady=\${Boolean(summary.candidateDemoReady)} nextRepairDemoReady=\${Boolean(summary.nextRepairDemoReady)} bodyGovernanceReady=\${Boolean(summary.bodyGovernanceReady)}\`,
      \`Entries: \${entries.map((entry) => \`\${entry.id}:\${entry.registry}:\${entry.phase}:mutation=\${Boolean(entry.mutation)}\`).join(", ")}\`,
      \`Memory: \${memory.label ?? "body_evidence_memory_v0"} purpose=\${memory.purpose ?? "none"}\`,
      \`Operator Use: \${(memory.operatorUse ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-timeline-readiness"} boundary=\${data.next?.boundary ?? "read-only readiness"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceTimelineReady.textContent = "false";
    bodyEvidenceTimelineEntries.textContent = "0";
    bodyEvidenceTimelineLatest.textContent = "offline";
    bodyEvidenceTimelineMutation.textContent = "false";
    bodyEvidenceTimelineJson.textContent = "Unable to read body evidence timeline.";
  }
}

async function refreshBodyEvidenceTimelineReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-timeline-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checks = Array.isArray(data.checks) ? data.checks : [];
    bodyEvidenceTimelineReadinessReady.textContent = String(Boolean(summary.ready));
    bodyEvidenceTimelineReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checks.length}\`;
    bodyEvidenceTimelineReadinessLatest.textContent = summary.latestEntryId ?? "unknown";
    bodyEvidenceTimelineReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceTimelineReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.ready)} checks=\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checks.length} entries=\${summary.timelineEntries ?? 0}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Checks: \${checks.map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Completed: \${data.completedBlock?.completionClaim ?? "unknown"} slices=\${(data.completedBlock?.completedSlices ?? []).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "whitepaper route review"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceTimelineReadinessReady.textContent = "false";
    bodyEvidenceTimelineReadinessChecks.textContent = "0/0";
    bodyEvidenceTimelineReadinessLatest.textContent = "offline";
    bodyEvidenceTimelineReadinessMutation.textContent = "false";
    bodyEvidenceTimelineReadinessJson.textContent = "Unable to read body evidence timeline readiness.";
  }
}

async function refreshBodyEvidenceLedgerPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const schema = plan.plannedRecordSchema ?? {};
    const gates = Array.isArray(plan.writeGates) ? plan.writeGates : [];
    bodyEvidenceLedgerPlanReady.textContent = String(Boolean(summary.planReady));
    bodyEvidenceLedgerPlanSchema.textContent = summary.plannedSchema ?? schema.version ?? "unknown";
    bodyEvidenceLedgerPlanGates.textContent = String(summary.writeGateCount ?? gates.length);
    bodyEvidenceLedgerPlanWritten.textContent = String(Boolean(summary.durableStorageWritten));
    bodyEvidenceLedgerPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} planReady=\${Boolean(summary.planReady)} timelineReady=\${Boolean(summary.timelineReady)} durableStorageWritten=\${Boolean(summary.durableStorageWritten)}\`,
      \`Governance: canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} storageWritten=\${Boolean(governance.durableStorageWritten)}\`,
      \`Schema: \${schema.version ?? "unknown"} required=\${(schema.requiredFields ?? []).join(",")}\`,
      \`Content: \${schema.contentPolicy ?? "unknown"}\`,
      \`Storage: \${plan.storageMode ?? "unknown"} status=\${plan.implementationStatus ?? "unknown"}\`,
      \`Write Gates: \${gates.map((gate) => \`\${gate.id}:required=\${Boolean(gate.requiredBeforeWrite)} passed=\${Boolean(gate.passed)}\`).join(", ")}\`,
      \`Verification: \${(plan.verificationPlan ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-route-review"} boundary=\${data.next?.boundary ?? "route review before writes"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerPlanReady.textContent = "false";
    bodyEvidenceLedgerPlanSchema.textContent = "offline";
    bodyEvidenceLedgerPlanGates.textContent = "0";
    bodyEvidenceLedgerPlanWritten.textContent = "false";
    bodyEvidenceLedgerPlanJson.textContent = "Unable to read body evidence ledger plan.";
  }
}

async function refreshBodyEvidenceLedgerRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    bodyEvidenceLedgerRouteReviewStatus.textContent = decision.status ?? "unknown";
    bodyEvidenceLedgerRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerRouteReviewWrite.textContent = String(Boolean(governance.canWriteLedger));
    bodyEvidenceLedgerRouteReviewMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canWriteLedger=\${Boolean(governance.canWriteLedger)} storageWritten=\${Boolean(governance.durableStorageWritten)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: ledgerPlanReady=\${Boolean(evidence.ledgerPlanReady)} schema=\${evidence.plannedSchema ?? "unknown"} gates=\${evidence.writeGateCount ?? 0} unmet=\${(evidence.unmetWriteGateIds ?? []).join(",") || "none"} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.id}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:write=\${Boolean(candidate.durableWrite)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-storage-root-plan"} boundary=\${data.next?.boundary ?? "storage root plan before writes"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerRouteReviewWrite.textContent = "false";
    bodyEvidenceLedgerRouteReviewMutation.textContent = "false";
    bodyEvidenceLedgerRouteReviewJson.textContent = "Unable to read body evidence ledger route review.";
  }
}

async function refreshBodyEvidenceLedgerStorageRootPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-storage-root-plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const selectedRoot = plan.selectedRoot ?? {};
    const candidateRoots = Array.isArray(plan.candidateRoots) ? plan.candidateRoots : [];
    bodyEvidenceLedgerStorageRootPlanReady.textContent = String(Boolean(summary.planReady));
    bodyEvidenceLedgerStorageRootPlanRoot.textContent = summary.selectedDisplayPath ?? selectedRoot.displayPath ?? "unknown";
    bodyEvidenceLedgerStorageRootPlanCreated.textContent = String(Boolean(summary.directoryCreated));
    bodyEvidenceLedgerStorageRootPlanWritten.textContent = String(Boolean(summary.durableStorageWritten));
    bodyEvidenceLedgerStorageRootPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} planReady=\${Boolean(summary.planReady)} routeReviewReady=\${Boolean(summary.routeReviewReady)} directoryCreated=\${Boolean(summary.directoryCreated)} durableStorageWritten=\${Boolean(summary.durableStorageWritten)}\`,
      \`Governance: canCreateDirectory=\${Boolean(governance.canCreateDirectory)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} storageWritten=\${Boolean(governance.durableStorageWritten)}\`,
      \`Selected: \${selectedRoot.id ?? "unknown"} path=\${selectedRoot.displayPath ?? "unknown"} policy=\${selectedRoot.rootPolicy ?? "unknown"}\`,
      \`Candidates: \${candidateRoots.map((root) => \`\${root.id}:\${root.displayPath}:recommended=\${Boolean(root.recommended)}:createsNow=\${Boolean(root.createsDirectoryNow)}:writesNow=\${Boolean(root.writesRecordsNow)}\`).join(", ")}\`,
      \`Path Policy: workspace=\${Boolean(plan.pathPolicy?.mustStayInsideWorkspace)} observerVisible=\${Boolean(plan.pathPolicy?.mustBeObserverVisible)} noCreate=\${Boolean(plan.pathPolicy?.mustNotCreateDirectoryInThisSlice)}\`,
      \`Pre-write Checks: \${(plan.preWriteChecks ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-storage-root-route-review"} boundary=\${data.next?.boundary ?? "route review before directory creation"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerStorageRootPlanReady.textContent = "false";
    bodyEvidenceLedgerStorageRootPlanRoot.textContent = "offline";
    bodyEvidenceLedgerStorageRootPlanCreated.textContent = "false";
    bodyEvidenceLedgerStorageRootPlanWritten.textContent = "false";
    bodyEvidenceLedgerStorageRootPlanJson.textContent = "Unable to read body evidence ledger storage root plan.";
  }
}

async function refreshBodyEvidenceLedgerStorageRootRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-storage-root-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    bodyEvidenceLedgerStorageRootRouteReviewStatus.textContent = decision.status ?? "unknown";
    bodyEvidenceLedgerStorageRootRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerStorageRootRouteReviewCreate.textContent = String(Boolean(governance.canCreateDirectory));
    bodyEvidenceLedgerStorageRootRouteReviewWritten.textContent = String(Boolean(governance.durableStorageWritten));
    bodyEvidenceLedgerStorageRootRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canCreateDirectory=\${Boolean(governance.canCreateDirectory)} canWriteLedger=\${Boolean(governance.canWriteLedger)} storageWritten=\${Boolean(governance.durableStorageWritten)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: root=\${evidence.selectedDisplayPath ?? "unknown"} insideWorkspace=\${Boolean(evidence.rootInsideWorkspace)} directoryCreated=\${Boolean(evidence.directoryCreated)} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      \`Pre-write Checks: \${(evidence.preWriteChecks ?? []).join(" | ")}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.id}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}:write=\${Boolean(candidate.durableWrite)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-directory-task"} boundary=\${data.next?.boundary ?? "directory task before record writes"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerStorageRootRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerStorageRootRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerStorageRootRouteReviewCreate.textContent = "false";
    bodyEvidenceLedgerStorageRootRouteReviewWritten.textContent = "false";
    bodyEvidenceLedgerStorageRootRouteReviewJson.textContent = "Unable to read body evidence ledger storage root route review.";
  }
}

async function refreshBodyEvidenceLedgerDirectoryTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-storage-root-route-review\`);
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const ready = decision.selectedSlice === "openclaw-body-evidence-ledger-directory-task"
      && decision.status === "selected"
      && evidence.rootInsideWorkspace === true;
    bodyEvidenceLedgerDirectoryTaskReady.textContent = String(ready);
    bodyEvidenceLedgerDirectoryTaskTarget.textContent = evidence.selectedDisplayPath ?? "unknown";
    bodyEvidenceLedgerDirectoryTaskApproval.textContent = ready ? "pending-after-create" : "route-blocked";
    bodyEvidenceLedgerDirectoryTaskCreated.textContent = String(Boolean(evidence.directoryCreated));
    bodyEvidenceLedgerDirectoryTaskJson.textContent = [
      "Registry: openclaw-body-evidence-ledger-directory-task-v0",
      \`Source Route: \${data.registry ?? "unknown"}\`,
      \`Mode: approval-gated-ledger-directory-task-shell ready=\${ready}\`,
      \`Target: \${evidence.selectedDisplayPath ?? "unknown"} insideWorkspace=\${Boolean(evidence.rootInsideWorkspace)} directoryCreated=\${Boolean(evidence.directoryCreated)} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      "Approval: creates pending medium-risk approval only after explicit button click",
      "Governance: createsTaskOnClick=true createsApprovalOnClick=true canCreateDirectory=false canWriteLedger=false mutation=false executed=false",
      "Endpoint: /body/evidence-ledger/directory-tasks",
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerDirectoryTaskReady.textContent = "false";
    bodyEvidenceLedgerDirectoryTaskTarget.textContent = "offline";
    bodyEvidenceLedgerDirectoryTaskApproval.textContent = "route-blocked";
    bodyEvidenceLedgerDirectoryTaskCreated.textContent = "false";
    bodyEvidenceLedgerDirectoryTaskJson.textContent = "Unable to read body evidence ledger directory task boundary.";
  }
}

async function refreshBodyEvidenceLedgerFirstRecordPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-first-record-plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const record = plan.plannedRecord ?? {};
    bodyEvidenceLedgerFirstRecordPlanReady.textContent = String(Boolean(summary.planReady));
    bodyEvidenceLedgerFirstRecordPlanType.textContent = summary.plannedRecordType ?? record.evidenceType ?? "unknown";
    bodyEvidenceLedgerFirstRecordPlanDirectory.textContent = String(Boolean(summary.directoryExists));
    bodyEvidenceLedgerFirstRecordPlanWritten.textContent = String(Boolean(summary.durableStorageWritten));
    bodyEvidenceLedgerFirstRecordPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} planReady=\${Boolean(summary.planReady)} ledgerPlanReady=\${Boolean(summary.ledgerPlanReady)} timelineReady=\${Boolean(summary.timelineReady)} directoryExists=\${Boolean(summary.directoryExists)} durableStorageWritten=\${Boolean(summary.durableStorageWritten)}\`,
      \`Governance: canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)}\`,
      \`Root: \${plan.ledgerRoot?.displayPath ?? "unknown"} resolved=\${plan.ledgerRoot?.resolvedPath ?? "unknown"} exists=\${Boolean(plan.ledgerRoot?.exists)}\`,
      \`Record: version=\${record.version ?? "unknown"} type=\${record.evidenceType ?? "unknown"} source=\${record.sourceRegistry ?? "unknown"} endpoint=\${record.sourceEndpoint ?? "unknown"}\`,
      \`Hash: \${record.contentHashStrategy ?? "unknown"}\`,
      \`Required: \${(plan.requiredFields ?? []).join(",")}\`,
      \`Pre-append Checks: \${(plan.preAppendChecks ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-first-record-route-review"} boundary=\${data.next?.boundary ?? "route review before first append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFirstRecordPlanReady.textContent = "false";
    bodyEvidenceLedgerFirstRecordPlanType.textContent = "offline";
    bodyEvidenceLedgerFirstRecordPlanDirectory.textContent = "false";
    bodyEvidenceLedgerFirstRecordPlanWritten.textContent = "false";
    bodyEvidenceLedgerFirstRecordPlanJson.textContent = "Unable to read body evidence ledger first record plan.";
  }
}

async function refreshBodyEvidenceLedgerFirstRecordRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-first-record-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    bodyEvidenceLedgerFirstRecordRouteReviewStatus.textContent = decision.status ?? "unknown";
    bodyEvidenceLedgerFirstRecordRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerFirstRecordRouteReviewWrite.textContent = String(Boolean(governance.canAppendLedgerRecord));
    bodyEvidenceLedgerFirstRecordRouteReviewWritten.textContent = String(Boolean(governance.durableStorageWritten));
    bodyEvidenceLedgerFirstRecordRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} storageWritten=\${Boolean(governance.durableStorageWritten)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} scheduler=\${Boolean(governance.schedulesFollowUp)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: planReady=\${Boolean(evidence.firstRecordPlanReady)} recordType=\${evidence.plannedRecordType ?? "unknown"} directoryExists=\${Boolean(evidence.directoryExists)} source=\${evidence.sourceRegistry ?? "unknown"} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      \`Pre-append Checks: \${(evidence.preAppendChecks ?? []).join(" | ")}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.id}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}:write=\${Boolean(candidate.durableWrite)}:scheduler=\${Boolean(candidate.scheduler)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-first-record-task"} boundary=\${data.next?.boundary ?? "approval-gated task shell before first append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFirstRecordRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerFirstRecordRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerFirstRecordRouteReviewWrite.textContent = "false";
    bodyEvidenceLedgerFirstRecordRouteReviewWritten.textContent = "false";
    bodyEvidenceLedgerFirstRecordRouteReviewJson.textContent = "Unable to read body evidence ledger first record route review.";
  }
}

async function refreshBodyEvidenceLedgerFirstRecordTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-first-record-route-review\`);
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const ready = decision.selectedSlice === "openclaw-body-evidence-ledger-first-record-task"
      && decision.status === "selected"
      && evidence.firstRecordPlanReady === true
      && evidence.directoryExists === true;
    bodyEvidenceLedgerFirstRecordTaskReady.textContent = String(ready);
    bodyEvidenceLedgerFirstRecordTaskType.textContent = evidence.plannedRecordType ?? "unknown";
    bodyEvidenceLedgerFirstRecordTaskApproval.textContent = ready ? "pending-after-create" : "route-blocked";
    bodyEvidenceLedgerFirstRecordTaskAppended.textContent = "false";
    bodyEvidenceLedgerFirstRecordTaskJson.textContent = [
      "Registry: openclaw-body-evidence-ledger-first-record-task-v0",
      \`Source Route: \${data.registry ?? "unknown"}\`,
      \`Mode: approval-gated-ledger-first-record-task-shell ready=\${ready}\`,
      \`Record: type=\${evidence.plannedRecordType ?? "unknown"} source=\${evidence.sourceRegistry ?? "unknown"} requiredFields=\${evidence.requiredFieldCount ?? 0} directoryExists=\${Boolean(evidence.directoryExists)} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      "Approval: creates pending medium-risk approval only after explicit button click",
      "Governance: createsTaskOnClick=true createsApprovalOnClick=true canAppendLedgerRecord=false canWriteLedger=false mutation=false appended=false",
      "Endpoint: /body/evidence-ledger/first-record-tasks",
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFirstRecordTaskReady.textContent = "false";
    bodyEvidenceLedgerFirstRecordTaskType.textContent = "offline";
    bodyEvidenceLedgerFirstRecordTaskApproval.textContent = "route-blocked";
    bodyEvidenceLedgerFirstRecordTaskAppended.textContent = "false";
    bodyEvidenceLedgerFirstRecordTaskJson.textContent = "Unable to read body evidence ledger first record task boundary.";
  }
}

async function refreshBodyEvidenceLedgerReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checks = Array.isArray(data.checks) ? data.checks : [];
    const records = Array.isArray(data.evidence?.records) ? data.evidence.records : [];
    bodyEvidenceLedgerReadinessReady.textContent = String(Boolean(summary.ready));
    bodyEvidenceLedgerReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checks.length}\`;
    bodyEvidenceLedgerReadinessRecords.textContent = String(summary.recordCount ?? records.length);
    bodyEvidenceLedgerReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.ready)} records=\${summary.recordCount ?? records.length} bootstrap=\${summary.bootstrapRecordCount ?? 0} file=\${summary.ledgerFile ?? "unknown"} exists=\${Boolean(summary.ledgerFileExists)}\`,
      \`Governance: canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} bulkImport=\${Boolean(governance.bulkImport)}\`,
      \`Checks: \${checks.map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Records: \${records.map((record) => \`\${record.id}:\${record.evidenceType}:hash=\${Boolean(record.hashValid)}:source=\${record.sourceRegistry}\`).join(", ") || "none"}\`,
      \`Completed: \${data.completedBlock?.completionClaim ?? "unknown"} slices=\${(data.completedBlock?.completedSlices ?? []).length}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "route review before more ledger writes"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerReadinessReady.textContent = "false";
    bodyEvidenceLedgerReadinessChecks.textContent = "0/0";
    bodyEvidenceLedgerReadinessRecords.textContent = "0";
    bodyEvidenceLedgerReadinessMutation.textContent = "false";
    bodyEvidenceLedgerReadinessJson.textContent = "Unable to read body evidence ledger readiness.";
  }
}

async function refreshBodyEvidenceLedgerDemoStatus() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-demo-status\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checklist = Array.isArray(data.checklist) ? data.checklist : [];
    const narrative = Array.isArray(data.demoNarrative) ? data.demoNarrative : [];
    bodyEvidenceLedgerDemoStatusReady.textContent = String(Boolean(summary.demoReady));
    bodyEvidenceLedgerDemoStatusChecks.textContent = \`\${summary.passed ?? 0}/\${summary.total ?? checklist.length}\`;
    bodyEvidenceLedgerDemoStatusRecord.textContent = summary.bootstrapRecordId ?? "none";
    bodyEvidenceLedgerDemoStatusMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerDemoStatusJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} demoReady=\${Boolean(summary.demoReady)} ledgerReady=\${Boolean(summary.ledgerReady)} records=\${summary.recordCount ?? 0} file=\${summary.ledgerFile ?? "unknown"}\`,
      \`Record: id=\${summary.bootstrapRecordId ?? "none"} hash=\${summary.bootstrapRecordHash ?? "none"}\`,
      \`Governance: canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} bulkImport=\${Boolean(governance.bulkImport)}\`,
      \`Checklist: \${checklist.map((item) => \`\${item.id}=\${Boolean(item.passed)}\`).join(", ")}\`,
      \`Narrative: \${narrative.join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "route review before more body capability work"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerDemoStatusReady.textContent = "false";
    bodyEvidenceLedgerDemoStatusChecks.textContent = "0/0";
    bodyEvidenceLedgerDemoStatusRecord.textContent = "offline";
    bodyEvidenceLedgerDemoStatusMutation.textContent = "false";
    bodyEvidenceLedgerDemoStatusJson.textContent = "Unable to read body evidence ledger demo status.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-followup-record-plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const record = plan.plannedRecord ?? {};
    const existingRecords = Array.isArray(plan.existingRecords) ? plan.existingRecords : [];
    bodyEvidenceLedgerFollowupRecordPlanReady.textContent = String(Boolean(summary.planReady));
    bodyEvidenceLedgerFollowupRecordPlanType.textContent = summary.plannedRecordType ?? record.evidenceType ?? "unknown";
    bodyEvidenceLedgerFollowupRecordPlanRecords.textContent = String(summary.existingRecordCount ?? existingRecords.length);
    bodyEvidenceLedgerFollowupRecordPlanWritten.textContent = String(Boolean(summary.durableStorageWritten));
    bodyEvidenceLedgerFollowupRecordPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} planReady=\${Boolean(summary.planReady)} timelineReady=\${Boolean(summary.timelineReady)} ledgerReady=\${Boolean(summary.ledgerReady)} existingRecords=\${summary.existingRecordCount ?? existingRecords.length} plannedSequence=\${summary.plannedSequence ?? "unknown"}\`,
      \`Governance: canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} bulkImport=\${Boolean(governance.bulkImport)}\`,
      \`Ledger: \${plan.ledgerFile?.displayPath ?? "unknown"} exists=\${Boolean(plan.ledgerFile?.exists)} lines=\${plan.ledgerFile?.lineCount ?? 0} latest=\${summary.latestRecordId ?? "none"} latestHashValid=\${Boolean(summary.latestRecordHashValid)}\`,
      \`Record: type=\${record.evidenceType ?? "unknown"} source=\${record.sourceRegistry ?? "unknown"} endpoint=\${record.sourceEndpoint ?? "unknown"} sequence=\${record.sequence ?? "unknown"}\`,
      \`Existing: \${existingRecords.map((item) => \`\${item.index}:\${item.id}:\${item.evidenceType}:hash=\${Boolean(item.hashValid)}\`).join(", ") || "none"}\`,
      \`Pre-append Checks: \${(plan.preAppendChecks ?? []).join(" | ")}\`,
      \`Deferred: \${(plan.deferredActions ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "route review before follow-up append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordPlanReady.textContent = "false";
    bodyEvidenceLedgerFollowupRecordPlanType.textContent = "offline";
    bodyEvidenceLedgerFollowupRecordPlanRecords.textContent = "0";
    bodyEvidenceLedgerFollowupRecordPlanWritten.textContent = "false";
    bodyEvidenceLedgerFollowupRecordPlanJson.textContent = "Unable to read body evidence ledger follow-up record plan.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-followup-record-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    bodyEvidenceLedgerFollowupRecordRouteReviewStatus.textContent = decision.status ?? "unknown";
    bodyEvidenceLedgerFollowupRecordRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerFollowupRecordRouteReviewWrite.textContent = String(Boolean(governance.canAppendLedgerRecord));
    bodyEvidenceLedgerFollowupRecordRouteReviewWritten.textContent = String(Boolean(governance.durableStorageWritten));
    bodyEvidenceLedgerFollowupRecordRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} storageWritten=\${Boolean(governance.durableStorageWritten)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: planReady=\${Boolean(evidence.followupRecordPlanReady)} recordType=\${evidence.plannedRecordType ?? "unknown"} sequence=\${evidence.plannedSequence ?? "unknown"} existingRecords=\${evidence.existingRecordCount ?? 0} source=\${evidence.sourceRegistry ?? "unknown"} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      \`Pre-append Checks: \${(evidence.preAppendChecks ?? []).join(" | ")}\`,
      \`Deferred: \${(evidence.deferredActions ?? []).join(" | ")}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.id}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}:write=\${Boolean(candidate.durableWrite)}:scheduler=\${Boolean(candidate.scheduler)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-followup-record-task"} boundary=\${data.next?.boundary ?? "future task shell before follow-up append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerFollowupRecordRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerFollowupRecordRouteReviewWrite.textContent = "false";
    bodyEvidenceLedgerFollowupRecordRouteReviewWritten.textContent = "false";
    bodyEvidenceLedgerFollowupRecordRouteReviewJson.textContent = "Unable to read body evidence ledger follow-up record route review.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-followup-record-route-review\`);
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const ready = decision.selectedSlice === "openclaw-body-evidence-ledger-followup-record-task"
      && decision.status === "selected"
      && evidence.followupRecordPlanReady === true
      && evidence.plannedRecordType === "body_evidence_timeline_followup"
      && evidence.plannedSequence === 2
      && evidence.existingRecordCount === 1;
    bodyEvidenceLedgerFollowupRecordTaskReady.textContent = String(ready);
    bodyEvidenceLedgerFollowupRecordTaskType.textContent = evidence.plannedRecordType ?? "unknown";
    bodyEvidenceLedgerFollowupRecordTaskApproval.textContent = ready ? "pending-after-create" : "route-blocked";
    bodyEvidenceLedgerFollowupRecordTaskAppended.textContent = "false";
    bodyEvidenceLedgerFollowupRecordTaskJson.textContent = [
      "Registry: openclaw-body-evidence-ledger-followup-record-task-v0",
      \`Source Route: \${data.registry ?? "unknown"}\`,
      \`Mode: approval-gated-ledger-followup-record-task-shell ready=\${ready}\`,
      \`Record: type=\${evidence.plannedRecordType ?? "unknown"} sequence=\${evidence.plannedSequence ?? "unknown"} existingRecords=\${evidence.existingRecordCount ?? 0} source=\${evidence.sourceRegistry ?? "unknown"} latest=\${evidence.latestRecordId ?? "none"} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      "Approval: creates pending medium-risk approval only after explicit button click",
      "Governance: createsTaskOnClick=true createsApprovalOnClick=true canAppendLedgerRecord=false canWriteLedger=false mutation=false appended=false scheduler=false backgroundWriter=false",
      "Endpoint: /body/evidence-ledger/followup-record-tasks",
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordTaskReady.textContent = "false";
    bodyEvidenceLedgerFollowupRecordTaskType.textContent = "offline";
    bodyEvidenceLedgerFollowupRecordTaskApproval.textContent = "route-blocked";
    bodyEvidenceLedgerFollowupRecordTaskAppended.textContent = "false";
    bodyEvidenceLedgerFollowupRecordTaskJson.textContent = "Unable to read body evidence ledger follow-up record task boundary.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/body-evidence-ledger-followup-record-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checklist = Array.isArray(data.checklist) ? data.checklist : [];
    const hardBoundary = Array.isArray(data.evidence?.hardBoundary) ? data.evidence.hardBoundary : [];
    bodyEvidenceLedgerFollowupRecordReadinessReady.textContent = String(Boolean(summary.ready));
    bodyEvidenceLedgerFollowupRecordReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checklist.length}\`;
    bodyEvidenceLedgerFollowupRecordReadinessRecords.textContent = String(summary.existingRecordCount ?? 0);
    bodyEvidenceLedgerFollowupRecordReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerFollowupRecordReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-body-evidence-ledger-followup-record-readiness-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} status=\${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} task=\${summary.taskId ?? "none"} approval=\${summary.approvalStatus ?? "unknown"}\`,
      \`Record: type=\${summary.plannedRecordType ?? "unknown"} sequence=\${summary.plannedSequence ?? "unknown"} existingRecords=\${summary.existingRecordCount ?? 0} appended=\${Boolean(summary.recordAppended)} durableStorageWritten=\${Boolean(summary.durableStorageWritten)}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} bulkImport=\${Boolean(governance.bulkImport)}\`,
      \`Checklist: \${checklist.map((item) => \`\${item.id}=\${item.status}\`).join(", ")}\`,
      \`Boundary: \${hardBoundary.join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "route review before any follow-up append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordReadinessReady.textContent = "false";
    bodyEvidenceLedgerFollowupRecordReadinessChecks.textContent = "0/0";
    bodyEvidenceLedgerFollowupRecordReadinessRecords.textContent = "0";
    bodyEvidenceLedgerFollowupRecordReadinessMutation.textContent = "false";
    bodyEvidenceLedgerFollowupRecordReadinessJson.textContent = "Unable to read body evidence ledger follow-up record readiness.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordAppendRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/body-evidence-ledger-followup-record-append-route-review\`);
    const decision = data.decision ?? {};
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewStatus.textContent = decision.status ?? data.status ?? "unknown";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewApproves.textContent = String(Boolean(governance.approvesTask));
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewAppended.textContent = String(Boolean(summary.recordAppended));
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-body-evidence-ledger-followup-record-append-route-review-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} status=\${data.status ?? "unknown"} ready=\${Boolean(summary.ready)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Record: task=\${summary.taskId ?? "none"} approval=\${summary.approvalStatus ?? "unknown"} sequence=\${summary.plannedSequence ?? "unknown"} existingRecords=\${summary.existingRecordCount ?? 0} appended=\${Boolean(summary.recordAppended)}\`,
      \`Governance: readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} approvesTask=\${Boolean(governance.approvesTask)} canAppend=\${Boolean(governance.canAppendLedgerRecord)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)}\`,
      \`Append Registry: openclaw-body-evidence-ledger-followup-record-append-v0\`,
      \`Append Endpoint: /body/evidence-ledger/followup-record-append\`,
      \`Next: \${data.next?.recommendedSlice ?? "unknown"} boundary=\${data.next?.boundary ?? "unknown"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewApproves.textContent = "false";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewAppended.textContent = "false";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewJson.textContent = "Unable to read body evidence ledger follow-up append route review.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordAppendReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/body-evidence-ledger-followup-record-append-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checklist = data.checklist ?? [];
    bodyEvidenceLedgerFollowupRecordAppendReadinessReady.textContent = String(Boolean(summary.ready));
    bodyEvidenceLedgerFollowupRecordAppendReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checklist.length}\`;
    bodyEvidenceLedgerFollowupRecordAppendReadinessRecords.textContent = String(summary.existingRecordCount ?? 0);
    bodyEvidenceLedgerFollowupRecordAppendReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerFollowupRecordAppendReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-body-evidence-ledger-followup-record-append-readiness-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} status=\${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} checks=\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checklist.length}\`,
      \`Record: task=\${summary.taskId ?? "none"} approval=\${summary.approvalStatus ?? "unknown"} record=\${summary.recordId ?? "none"} previous=\${summary.previousRecordId ?? "none"} records=\${summary.existingRecordCount ?? 0} appended=\${Boolean(summary.recordAppended)} durable=\${Boolean(summary.durableStorageWritten)}\`,
      \`Hash: previous=\${summary.previousRecordHash ?? "none"} current=\${summary.contentHash ?? "none"}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} canAppend=\${Boolean(governance.canAppendLedgerRecord)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Next: \${data.next?.recommendedSlice ?? "unknown"} boundary=\${data.next?.boundary ?? "unknown"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordAppendReadinessReady.textContent = "false";
    bodyEvidenceLedgerFollowupRecordAppendReadinessChecks.textContent = "0/0";
    bodyEvidenceLedgerFollowupRecordAppendReadinessRecords.textContent = "0";
    bodyEvidenceLedgerFollowupRecordAppendReadinessMutation.textContent = "false";
    bodyEvidenceLedgerFollowupRecordAppendReadinessJson.textContent = "Unable to read body evidence ledger follow-up append readiness.";
  }
}

`;
