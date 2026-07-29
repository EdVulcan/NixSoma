#!/usr/bin/env bash

openclaw_start_local_ocr_workbench() {
  local output_dir="$1"
  local surface_id inventory_sequence active activate_payload

  post_json "$CORE_URL/capabilities/invoke" \
    '{"capabilityId":"act.work_view.control","operation":"work_view.application.start","params":{}}' \
    > "$output_dir/start.json"

  for _ in $(seq 1 120); do
    curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$output_dir/state.json"
    if node -e '
      const fs = require("node:fs");
      const workView = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).workView ?? {};
      const lifecycle = workView.aiGraphicalSession?.applicationLifecycle ?? {};
      const inventory = workView.aiGraphicalSession?.surfaceInventory ?? {};
      const surfaceId = lifecycle.matchingSurface?.surfaceId;
      const surface = inventory.surfaces?.find((item) => item.surfaceId === surfaceId);
      process.exit(lifecycle.status === "running"
        && lifecycle.surfaceAttached === true
        && Number.isInteger(surfaceId)
        && surface ? 0 : 1);
    ' "$output_dir/state.json"; then
      break
    fi
    sleep 0.05
  done

  read -r surface_id inventory_sequence active < <(node -e '
    const fs = require("node:fs");
    const workView = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).workView ?? {};
    const lifecycle = workView.aiGraphicalSession?.applicationLifecycle ?? {};
    const inventory = workView.aiGraphicalSession?.surfaceInventory ?? {};
    const surfaceId = lifecycle.matchingSurface?.surfaceId;
    const matches = inventory.surfaces?.filter((surface) => surface.surfaceId === surfaceId) ?? [];
    if (lifecycle.status !== "running"
      || lifecycle.surfaceAttached !== true
      || matches.length !== 1
      || !Number.isInteger(inventory.sequence)) process.exit(1);
    console.log(`${matches[0].surfaceId} ${inventory.sequence} ${matches[0].activated === true}`);
  ' "$output_dir/state.json")

  if [[ "$active" != "true" ]]; then
    activate_payload="$(node -e '
      console.log(JSON.stringify({
        capabilityId: "act.work_view.control",
        operation: "work_view.surface.activate",
        params: { surfaceId: Number(process.argv[1]), inventorySequence: Number(process.argv[2]) },
      }));
    ' "$surface_id" "$inventory_sequence")"
    post_json "$CORE_URL/capabilities/invoke" "$activate_payload" > "$output_dir/activate.json"
  fi

  for _ in $(seq 1 120); do
    curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$output_dir/active-state.json"
    if node -e '
      const fs = require("node:fs");
      const expected = Number(process.argv[2]);
      const workView = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).workView ?? {};
      const inventory = workView.aiGraphicalSession?.surfaceInventory ?? {};
      const active = inventory.surfaces?.filter((surface) => surface.activated === true) ?? [];
      process.exit(active.length === 1 && active[0].surfaceId === expected ? 0 : 1);
    ' "$output_dir/active-state.json" "$surface_id"; then
      printf '%s %s\n' "$surface_id" "$inventory_sequence"
      return 0
    fi
    sleep 0.05
  done

  printf 'Fixed local OCR Workbench did not become the only active surface.\n' >&2
  return 1
}
