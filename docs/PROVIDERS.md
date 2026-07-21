# Model Providers

Arena talks to model providers through a **self-registering registry**. Each
provider is a single module under `src/models/` that calls `register(...)` with
its class and a capability declaration; a directory scan (`bootstrap.js`) imports
them all at startup. Adding a provider requires **zero edits** to
`src/models/factory.js` or `src/utils/config.js` — drop in a new module and it
appears everywhere, including the table below and `arena providers`.

## Registered providers

The table below is **generated from the live registry** — it reflects over each
provider's declared `capabilities` (auth style, endpoint, stream style and how
the stream terminates) and `config` (the api-key env var, or the default base
URL for local providers). Regenerate it with:

```bash
npm run gen:providers
```

<!-- PROVIDERS:START -->
| Provider | Auth | Endpoint | Stream (style / termination) | API-key env / base URL |
|----------|------|----------|------------------------------|------------------------|
| `anthropic` | header: x-api-key | `https://api.anthropic.com/v1/messages` | sse ([DONE] sentinel) | `ANTHROPIC_API_KEY` |
| `azure` | header: api-key | `https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}` | sse ([DONE] sentinel) | `AZURE_OPENAI_API_KEY` |
| `cohere` | Bearer token | `https://api.cohere.com/v2/chat` | sse (message-end event) | `CO_API_KEY` |
| `google` | query param: key | `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse` | sse (stream-close) | `GOOGLE_API_KEY` |
| `huggingface` | Bearer token | `https://api-inference.huggingface.co/models/{model}` | sse (stream-close) | `HF_API_TOKEN` |
| `mistral` | Bearer token | `https://api.mistral.ai/v1/chat/completions` | sse ([DONE] sentinel) | `MISTRAL_API_KEY` |
| `ollama` | none | `{base_url}/api/generate` | ndjson (stream-close) | `base_url default: http://localhost:11434` |
| `openai` | Bearer token | `https://api.openai.com/v1/chat/completions` | sse ([DONE] sentinel) | `OPENAI_API_KEY` |

> _8 providers — generated from the live registry by `npm run gen:providers`. Do not edit by hand._
<!-- PROVIDERS:END -->

## How to read the table

- **Auth** — how the API key is presented on the wire:
  - `Bearer token` → `Authorization: Bearer <key>` (openai, mistral, cohere, huggingface)
  - `header: <name>` → a custom header carries the key (anthropic `x-api-key`, azure `api-key`)
  - `query param: <name>` → the key is appended to the URL (google `?key=`)
  - `none` → no auth; local models (ollama)
- **Endpoint** — the request URL. `{model}` / `{resource}` / `{deployment}` /
  `{apiVersion}` / `{base_url}` are placeholders filled in at request time.
- **Stream (style / termination)** — the wire framing and how a stream ends:
  - `sse` — Server-Sent-Events `data:` lines; `ndjson` — newline-delimited JSON.
  - `[DONE] sentinel` — ends on a `data: [DONE]` line (openai, anthropic, google, mistral, azure).
  - `message-end event` — ends on a typed `message-end` event, no sentinel (cohere).
  - `stream-close` — ends when the HTTP body closes, no sentinel (huggingface, ollama).
- **API-key env / base URL** — the environment variable holding the key, or the
  default base URL for local providers.

## Inspecting providers at runtime

```bash
arena providers
```

lists the same information from the live registry in your terminal.

## Adding a provider

1. Create `src/models/<name>.js`.
2. Implement a class extending `BaseProvider` with `async *stream(prompt)`.
   Resolve the API key lazily inside `stream()`:
   `const { getApiKey } = await import('../utils/config.js')`.
3. Call `register({ name, Provider, config: { apiKeyEnv } | { baseUrlDefault }, capabilities: {...} })`
   at module load. The `capabilities` block is what the table and `arena providers`
   reflect over, so fill in `auth` (+ `authHeader`/`authParam`), `endpoint`, and
   `stream: { style, terminator }`.
4. Run `npm run gen:providers` to refresh this table and the README.

No edits to `factory.js` or `config.js` are needed — the dir-scan and the
registry-derived config pick the new provider up automatically.
