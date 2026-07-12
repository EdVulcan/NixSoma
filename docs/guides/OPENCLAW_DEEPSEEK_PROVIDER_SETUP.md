# DeepSeek Provider Setup

The live provider sender is disabled by default. It accepts only the DeepSeek
OpenAI-compatible endpoint and reads the API key from the process environment.
The key is never part of repository files, task evidence, or command output.

Configure a temporary shell session:

```bash
export OPENCLAW_CLOUD_PROVIDER_ENDPOINT='https://api.deepseek.com'
export OPENCLAW_CLOUD_PROVIDER_MODEL='deepseek-chat'
read -r -s -p 'DeepSeek API key: ' OPENCLAW_CLOUD_PROVIDER_API_KEY
printf '\n'
export OPENCLAW_CLOUD_PROVIDER_API_KEY
export OPENCLAW_CLOUD_PROVIDER_LIVE_EGRESS=true
```

Run one bounded connectivity check only when the request is explicitly
authorized:

```bash
node nix/scripts/dev-openclaw-cloud-consciousness-live-provider-one-shot.mjs --confirm-live-call
```

The command prints only the bounded model response and redacted audit metadata.
Clear the variables when finished:

```bash
unset OPENCLAW_CLOUD_PROVIDER_ENDPOINT
unset OPENCLAW_CLOUD_PROVIDER_MODEL
unset OPENCLAW_CLOUD_PROVIDER_API_KEY
unset OPENCLAW_CLOUD_PROVIDER_LIVE_EGRESS
```

For the existing approval-gated egress execution task, provide the request only
on the operator execution call so the prompt is not persisted in task state:

```json
{
  "liveProviderExecution": {
    "requested": true,
    "taskId": "<approved-egress-task-id>",
    "credentialReference": "openclaw://credential/deepseek-api-key",
    "requestEnvelope": {
      "model": "deepseek-chat",
      "messages": [{"role": "user", "content": "<bounded prompt>"}]
    },
    "authorization": {
      "confirmed": true,
      "credentialValueAccessAuthorized": true,
      "endpointNetworkEgressAuthorized": true,
      "liveProviderCallEnabled": true
    }
  }
}
```

Send that object as the body of `POST /operator/step` after the task approval
is recorded. The response content is returned only in that execution response;
the durable task record keeps hashes, status, usage, and endpoint evidence.

Neither path turns on automatic provider calls for OpenClaw tasks. The existing
task and Observer lanes remain approval-gated, and the live branch requires the
explicit operator request above.
