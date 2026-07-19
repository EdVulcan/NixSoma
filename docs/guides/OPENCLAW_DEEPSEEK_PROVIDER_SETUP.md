# DeepSeek Provider Setup

The live provider sender is disabled by default. It accepts only the DeepSeek
OpenAI-compatible endpoint. A deployed Core reads the API key from a systemd
credential file; the legacy environment value remains available only for a
temporary development process. The key is never part of Nix expressions,
generated units, repository files, task evidence, or command output.

For persistent NixOS use, first provision a root-owned credential source outside
the Nix store, then configure the module with its path:

```nix
services.openclaw.cloudProvider = {
  enable = true;
  endpoint = "https://api.deepseek.com";
  model = "deepseek-chat";
  apiKeyFile = "/var/lib/openclaw/deepseek-api-key";
  liveEgress = true;
};
```

Core receives that source as `%d/deepseek-api-key` through
`LoadCredential=`. Build and inspect the candidate before switching. The
desktop profile preconfigures the endpoint and model but intentionally leaves
live egress disabled until `apiKeyFile` is explicitly supplied.

Configure a temporary shell session:

```bash
export OPENCLAW_CLOUD_PROVIDER_ENDPOINT='https://api.deepseek.com'
export OPENCLAW_CLOUD_PROVIDER_MODEL='deepseek-chat'
read -r -s -p 'DeepSeek API key: ' temporary_deepseek_key
printf '\n'
temporary_key_file="$(mktemp)"
chmod 600 "$temporary_key_file"
printf '%s\n' "$temporary_deepseek_key" > "$temporary_key_file"
unset temporary_deepseek_key
export OPENCLAW_CLOUD_PROVIDER_API_KEY_FILE="$temporary_key_file"
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
rm -f "$OPENCLAW_CLOUD_PROVIDER_API_KEY_FILE"
unset OPENCLAW_CLOUD_PROVIDER_API_KEY_FILE
unset OPENCLAW_CLOUD_PROVIDER_LIVE_EGRESS
```

For an approval-gated egress execution task, bind the request when the task is
created. The task stores only the endpoint fingerprint, model, exact
credential reference, request hash, optional context hash, response contract,
and authorization flags; it does not store the prompt or credential value:

```json
{
  "confirm": true,
  "liveProviderExecution": {
    "requested": true,
    "credentialReference": "openclaw://credential/deepseek-api-key",
    "requestEnvelope": {
      "model": "deepseek-chat",
      "messages": [{"role": "user", "content": "<bounded prompt>"}]
    }
  }
}
```

POST that body to `/cloud-consciousness/live-provider-egress-execution-tasks`,
then wait for the returned task approval. Execute only the same bound request
on `/operator/step`:

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
is recorded. The endpoint fingerprint, model, credential reference, request
hash, context hash, response contract, and authorization flags are rechecked
against the approval binding before any credential read or network request.
Changing the prompt, model, credential reference, or egress flags is rejected;
the response content is returned only in that execution response;
the durable task record keeps hashes, status, usage, and endpoint evidence.

To send the existing local Engineering Context Packet instead of supplying a
manual prompt, the materialized packet request and its `contextContentHash`
must first be used to create the task binding. Do not send an unbound context
request to `/operator/step`. After that binding exists, the execution request
can use this bounded context form:

```json
{
  "liveProviderExecution": {
    "requested": true,
    "taskId": "<approved-egress-task-id>",
    "contextPacket": {
      "requested": true,
      "taskId": "<approved-egress-task-id>",
      "sourceTaskId": "<existing-engineering-evidence-task-id>",
      "responseContract": "engineering_recommendation_v0",
      "limit": 6,
      "maxOutputChars": 1800,
      "includeWorkView": true,
      "includeWorkViewObservation": true,
      "includePlanTodo": true,
      "instruction": "Review the local engineering evidence and recommend the next verification step."
    },
    "contextContentHash": "<sha256-of-the-bound-materialized-context>",
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
counts, hashes, and truncation evidence are retained on the task. The binding
must describe that same materialized request; a changed context hash is
rejected. Do not send both `contextPacket` and `requestEnvelope` in the same
execution request. The context
packet defaults to `engineering_recommendation_v0`; the provider must return
JSON that selects one existing allowlisted Observer action and sets
`requiresOperatorReview` to `true`. The response cannot create a task, approval,
or execution automatically. The full recommendation reason is transient; the
task keeps only action, control, capability, contract, hash, and governance
evidence.

The work-view and plan/todo selectors are optional and explicit. When enabled,
the request includes only bounded capture freshness/frame provenance/target
counts and bounded visible plan/todo summaries. It excludes page URLs, pixels,
page text, target items, selectors, input values, lease ids, and credentials.
`includeWorkViewObservation` requires `includeWorkView`; changing any selector
changes the materialized request hash and is rejected if it no longer matches
the approved binding.

`sourceTaskId` is also optional. When provided, it must identify an existing
source-command, verification, edit, or workbench task whose bounded evidence
should be reviewed. The egress task remains the approval/execution owner; the
source task is read-only and is not resumed or mutated. Both ids are retained
only as compact provenance.

Neither path turns on automatic provider calls for OpenClaw tasks. The existing
task and Observer lanes remain approval-gated, and the live branch requires the
explicit operator request above.
