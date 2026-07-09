prepare_engineering_microcompact_evidence_fixture() {
  local workspace_dir="$1"
  local prompt_secret="$2"
  local tool_secret="$3"

  prepare_engineering_verification_evidence_fixture "$workspace_dir" "$prompt_secret" "$tool_secret"

  cat > "$workspace_dir/package.json" <<'JSON'
{
  "name": "openclaw",
  "private": true,
  "scripts": {
    "typecheck": "node -e \"process.stdout.write('engineering-microcompact-evidence-large-output:' + 'M'.repeat(1500))\""
  }
}
JSON
}
