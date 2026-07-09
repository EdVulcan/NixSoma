prepare_engineering_edit_proposal_fixture() {
  local workspace_dir="$1"
  local secret_prefix="$2"

  mkdir -p \
    "$workspace_dir/.git" \
    "$workspace_dir/.openclaw" \
    "$workspace_dir/src" \
    "$workspace_dir/node_modules/pkg" \
    "$workspace_dir/.cache" \
    "$workspace_dir/generated"

  cat > "$workspace_dir/package.json" <<JSON
{
  "name": "openclaw-engineering-edit-proposal-fixture",
  "version": "0.0.0",
  "private": true,
  "description": "OpenClaw on NixOS monorepo skeleton"
}
JSON

  cat > "$workspace_dir/src/app.ts" <<TS
export const before = "context";
export const target = "OpenClawNeedle";
export const after = "context";
TS

  cat > "$workspace_dir/src/duplicate.ts" <<TS
repeat
repeat
TS

  head -c 4096 /dev/zero | tr '\0' 'x' > "$workspace_dir/src/large.txt"

  cat > "$workspace_dir/node_modules/pkg/leak.ts" <<TS
export const nodeModulesLeak = "${secret_prefix}_NODE_MODULES_SECRET OpenClaw on NixOS monorepo skeleton";
TS
  cat > "$workspace_dir/.cache/leak.ts" <<TS
export const cacheLeak = "${secret_prefix}_CACHE_SECRET OpenClaw on NixOS monorepo skeleton";
TS
  cat > "$workspace_dir/generated/leak.ts" <<TS
export const generatedLeak = "${secret_prefix}_GENERATED_SECRET OpenClaw on NixOS monorepo skeleton";
TS
}
