prepare_engineering_recovery_evidence_fixture() {
  local workspace_dir="$1"
  local prompt_secret="$2"
  local tool_secret="$3"

  prepare_engineering_verification_evidence_fixture "$workspace_dir" "$prompt_secret" "$tool_secret"

  cat > "$workspace_dir/package.json" <<'JSON'
{
  "name": "openclaw",
  "private": true,
  "scripts": {
    "typecheck": "node -e \"process.stdout.write('engineering-recovery-evidence-failed'); process.stderr.write('recoverable failure'); process.exit(7)\""
  }
}
JSON
}
