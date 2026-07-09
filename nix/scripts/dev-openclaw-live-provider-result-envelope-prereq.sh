#!/usr/bin/env bash

openclaw_result_envelope_clear_target_state() {
  local target_core_state="$1"
  local target_system_heal_state="$2"

  rm -f "$target_core_state" "$target_core_state.tmp" "$target_system_heal_state" "$target_system_heal_state.tmp"
}

openclaw_result_envelope_load_fast_prereq_helper() {
  local script_dir="$1"

  if [[ -f "$script_dir/dev-openclaw-fast-prereq-state.sh" ]]; then
    # shellcheck source=/dev/null
    source "$script_dir/dev-openclaw-fast-prereq-state.sh"
  fi
}

openclaw_result_envelope_slug_suffix() {
  local slug="$1"
  printf '%s\n' "${slug#openclaw-cloud-consciousness-live-provider-}"
}

openclaw_result_envelope_manifest_file() {
  local script_dir="$1"
  printf '%s\n' "${OPENCLAW_LIVE_PROVIDER_RESULT_ENVELOPE_MILESTONES_FILE:-$script_dir/openclaw-live-provider-result-envelope-milestones.tsv}"
}

openclaw_result_envelope_manifest_row_for_phase() {
  local script_dir="$1"
  local phase="$2"
  local manifest_file
  manifest_file="$(openclaw_result_envelope_manifest_file "$script_dir")"

  awk -F '\t' -v phase="$phase" '
    $0 !~ /^#/ && NF >= 6 && $1 == phase { print; found = 1 }
    END { if (!found) exit 1 }
  ' "$manifest_file"
}

openclaw_result_envelope_manifest_row_for_slug() {
  local script_dir="$1"
  local slug="$2"
  local manifest_file
  manifest_file="$(openclaw_result_envelope_manifest_file "$script_dir")"

  awk -F '\t' -v slug="$slug" '
    $0 !~ /^#/ && NF >= 6 && $2 == slug { print; found = 1 }
    END { if (!found) exit 1 }
  ' "$manifest_file"
}

openclaw_result_envelope_primary_registry_for_slug() {
  local slug="$1"

  if [[ "$slug" == *-task-shell ]]; then
    printf '%s\n' "${slug%-task-shell}-task-v0"
    return 0
  fi
  printf '%s\n' "$slug-v0"
}

openclaw_result_envelope_persisted_marker_for_slug() {
  local slug="$1"
  local base
  base="$(openclaw_result_envelope_slug_suffix "$slug")"
  base="${base//-/_}"

  if [[ "$slug" == *-task-shell ]]; then
    printf '%s\n' "cloud_consciousness_live_provider_${base}_deferred"
    return 0
  fi
  if [[ "$slug" == *-final-readiness-preflight ]]; then
    printf '%s\n' "${base}_recorded"
    return 0
  fi
  printf '%s\n' "${base}_ready"
}

openclaw_result_envelope_durable_fast_source() {
  local script_dir="$1"
  local current_phase="$2"
  local row phase slug core_description observer_description predecessor_slug next_slug

  row="$(openclaw_result_envelope_manifest_row_for_phase "$script_dir" "$current_phase")" || return 1
  IFS=$'\t' read -r phase slug core_description observer_description predecessor_slug next_slug <<< "$row"

  local source_slug="$predecessor_slug"
  if [[ "$predecessor_slug" == *-route || "$predecessor_slug" == *-approved-deferred ]]; then
    local predecessor_row predecessor_phase predecessor_core_description predecessor_observer_description predecessor_predecessor_slug predecessor_next_slug
    predecessor_row="$(openclaw_result_envelope_manifest_row_for_slug "$script_dir" "$predecessor_slug")" || return 1
    IFS=$'\t' read -r predecessor_phase source_slug predecessor_core_description predecessor_observer_description predecessor_predecessor_slug predecessor_next_slug <<< "$predecessor_row"
    source_slug="$predecessor_predecessor_slug"
  fi

  local source_row source_phase source_core_description source_observer_description source_predecessor_slug source_next_slug
  source_row="$(openclaw_result_envelope_manifest_row_for_slug "$script_dir" "$source_slug")" || return 1
  IFS=$'\t' read -r source_phase source_slug source_core_description source_observer_description source_predecessor_slug source_next_slug <<< "$source_row"

  printf '%s\t%s\t%s\t%s\n' \
    "$source_phase" \
    "$source_slug" \
    "$(openclaw_result_envelope_primary_registry_for_slug "$source_slug")" \
    "$(openclaw_result_envelope_persisted_marker_for_slug "$source_slug")"
}

openclaw_result_envelope_find_reusable_core_state() {
  local repo_root="$1"
  local canonical_core_state="$2"
  local source_phase="$3"
  local expected_registry="$4"
  local expected_marker="$5"

  node - "$repo_root" "$canonical_core_state" "$source_phase" "$expected_registry" "$expected_marker" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [repoRoot, canonicalCoreState, sourcePhaseText, expectedRegistry, expectedMarker] = process.argv.slice(2);
const sourcePhase = Number.parseInt(sourcePhaseText, 10);
const artifactDir = path.join(repoRoot, ".artifacts");
const candidates = [];

function addCandidate(file, rank, endPhase = sourcePhase) {
  if (!file || !fs.existsSync(file)) return;
  candidates.push({ file, rank, endPhase, mtimeMs: fs.statSync(file).mtimeMs });
}

addCandidate(canonicalCoreState, 0);

if (Number.isInteger(sourcePhase) && fs.existsSync(artifactDir)) {
  for (const name of fs.readdirSync(artifactDir)) {
    const match = /^openclaw-core-result-envelope-batch-(\d+)-(\d+)-check\.json$/.exec(name);
    if (!match) continue;
    const endPhase = Number.parseInt(match[2], 10);
    if (endPhase > sourcePhase) continue;
    addCandidate(path.join(artifactDir, name), 1, endPhase);
  }
}

candidates.sort((left, right) =>
  left.rank - right.rank
  || right.endPhase - left.endPhase
  || right.mtimeMs - left.mtimeMs
  || left.file.localeCompare(right.file)
);

for (const candidate of candidates) {
  try {
    const raw = fs.readFileSync(candidate.file, "utf8");
    JSON.parse(raw);
    if (raw.includes(expectedRegistry) && raw.includes(expectedMarker)) {
      console.log(candidate.file);
      process.exit(0);
    }
  } catch {
    // Ignore malformed or concurrently-written artifacts.
  }
}

process.exit(1);
NODE
}

openclaw_result_envelope_prepare_prereq_state() {
  local script_dir="$1"
  local source_core_state="$2"
  local source_system_heal_state="$3"
  local target_core_state="$4"
  local target_system_heal_state="$5"
  local prereq_name="$6"
  local expected_registry="$7"
  local expected_marker="$8"
  local fallback_port_base_env="$9"
  local fallback_common_check="${10}"

  if [[ "${OPENCLAW_DEV_SERVICES_ALREADY_UP:-false}" == "true" ]]; then
    echo "Using already-running OpenClaw dev services as the live $prereq_name prerequisite state."
    return 0
  fi

  openclaw_result_envelope_clear_target_state "$target_core_state" "$target_system_heal_state"
  openclaw_result_envelope_load_fast_prereq_helper "$script_dir"

  local effective_source_core_state="$source_core_state"
  local effective_source_system_heal_state="$source_system_heal_state"
  local effective_prereq_name="$prereq_name"
  local effective_expected_registry="$expected_registry"
  local effective_expected_marker="$expected_marker"

  if [[ -n "${OPENCLAW_RESULT_ENVELOPE_PHASE:-}" ]]; then
    local durable_source
    if durable_source="$(openclaw_result_envelope_durable_fast_source "$script_dir" "$OPENCLAW_RESULT_ENVELOPE_PHASE" 2>/dev/null)"; then
      local fast_source_phase fast_source_slug fast_source_registry fast_source_marker fast_source_suffix
      IFS=$'\t' read -r fast_source_phase fast_source_slug fast_source_registry fast_source_marker <<< "$durable_source"
      fast_source_suffix="$(openclaw_result_envelope_slug_suffix "$fast_source_slug")"
      effective_source_core_state="$REPO_ROOT/.artifacts/openclaw-core-phase-${fast_source_phase}-${fast_source_suffix}-check.json"
      effective_source_system_heal_state=""
      effective_prereq_name="phase-${fast_source_phase}-${fast_source_suffix}-state"
      effective_expected_registry="$fast_source_registry"
      effective_expected_marker="$fast_source_marker"

      local reusable_core_state
      if reusable_core_state="$(openclaw_result_envelope_find_reusable_core_state "$REPO_ROOT" "$effective_source_core_state" "$fast_source_phase" "$effective_expected_registry" "$effective_expected_marker" 2>/dev/null)"; then
        effective_source_core_state="$reusable_core_state"
      fi
    fi
  fi

  if ! declare -F openclaw_reuse_prereq_state >/dev/null \
    || ! openclaw_reuse_prereq_state \
      "$effective_source_core_state" \
      "$effective_source_system_heal_state" \
      "$target_core_state" \
      "$target_system_heal_state" \
      "$effective_prereq_name" \
      "$effective_expected_registry" \
      "$effective_expected_marker"; then
    env "$fallback_port_base_env=$PORT_BASE" \
      OPENCLAW_CORE_STATE_FILE="$target_core_state" \
      OPENCLAW_SYSTEM_HEAL_STATE_FILE="$target_system_heal_state" \
      bash "$script_dir/$fallback_common_check" >/dev/null
  fi
}
