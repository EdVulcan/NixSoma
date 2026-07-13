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

To send the existing local Engineering Context Packet instead of supplying a
manual prompt, replace `requestEnvelope` with this bounded context request:

```json
{
  "liveProviderExecution": {
    "requested": true,
    "taskId": "<approved-egress-task-id>",
    "contextPacket": {
      "requested": true,
      "taskId": "<approved-egress-task-id>",
      "responseContract": "engineering_recommendation_v0",
      "limit": 6,
      "maxOutputChars": 1800,
      "instruction": "Review the local engineering evidence and recommend the next verification step."
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

The context packet is assembled in memory for that operator call. Existing
command output is bounded, credential-like text is redacted, and only packet
counts, hashes, and truncation evidence are retained on the task. Do not send
both `contextPacket` and `requestEnvelope` in the same request. The context
packet defaults to `engineering_recommendation_v0`; the provider must return
JSON that selects one existing allowlisted Observer action and sets
`requiresOperatorReview` to `true`. The response cannot create a task, approval,
or execution automatically. The full recommendation reason is transient; the
task keeps only action, control, capability, contract, hash, and governance
evidence.

Neither path turns on automatic provider calls for OpenClaw tasks. The existing
task and Observer lanes remain approval-gated, and the live branch requires the
explicit operator request above.
