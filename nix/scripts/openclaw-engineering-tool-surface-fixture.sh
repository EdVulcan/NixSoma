prepare_engineering_tool_surface_fixture() {
  local workspace_dir="$1"
  local secret_prefix="$2"
  local cc_tools_dir="$workspace_dir/extensions/cc-tools/src"

  mkdir -p \
    "$workspace_dir/.git" \
    "$workspace_dir/.openclaw" \
    "$cc_tools_dir/tools" \
    "$cc_tools_dir/lsp"

  cat > "$workspace_dir/package.json" <<JSON
{
  "name": "openclaw",
  "version": "0.0.0-${secret_prefix}-secret-version",
  "private": true,
  "scripts": {
    "build": "echo ${secret_prefix}_ROOT_SECRET_BUILD_BODY"
  }
}
JSON

  cat > "$cc_tools_dir/index.ts" <<TS
/*
 * Exported tools:
 *   cc_read
 *   cc_edit
 *   cc_write
 *   cc_glob
 *   cc_grep
 *   cc_plan_enter
 *   cc_plan_exit
 *   cc_todo_write
 *   cc_lsp
 *   cc_verify
 */
export function createCCTools() {
  const ${secret_prefix}_INDEX_SECRET_SOURCE = "must-not-leak";
  return [];
}
TS

  for relative_path in \
    tools/FileReadTool.ts \
    tools/FileEditTool.ts \
    tools/FileWriteTool.ts \
    tools/GlobTool.ts \
    tools/GrepTool.ts \
    tools/PlanModeTool.ts \
    tools/VerifyCodeTool.ts \
    lsp/LSPTool.ts \
    lsp/lsp-manager.ts
  do
    printf 'export const %s_%s_SECRET_SOURCE = "must-not-leak";\n' \
      "$secret_prefix" \
      "$(printf '%s' "$relative_path" | tr '/.-' '___')" \
      > "$cc_tools_dir/$relative_path"
  done
}
