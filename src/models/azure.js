import { BaseProvider } from './provider.js';
import { register, lookup } from './registry.js';
import { readStreamLines, assertResponseOk } from '../utils/sse.js';

// Azure OpenAI is OpenAI-shaped on the request/stream BODY, but differs from
// plain OpenAI in two load-bearing ways:
//   1. Auth is an `api-key: <key>` HEADER — NOT `Authorization: Bearer`. Sending
//      a Bearer header is wrong for Azure, so we deliberately never set one.
//   2. The URL is deployment + api-version style:
//        https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}
// The resource name, deployment name, and api-version are configuration knobs.
// They are declared on this provider's `config` metadata below (env-var names +
// a default api-version) so they resolve from the environment with ZERO edits to
// config.js — the declaration itself carries the knobs.
const AZURE_CONFIG = {
  apiKeyEnv: 'AZURE_OPENAI_API_KEY',       // holds the API key (api-key header)
  resourceEnv: 'AZURE_OPENAI_RESOURCE',    // {resource} in the URL host
  deploymentEnv: 'AZURE_OPENAI_DEPLOYMENT', // {deployment} path segment; defaults to the model name
  apiVersionEnv: 'AZURE_OPENAI_API_VERSION', // ?api-version=...; overrides the default below
  apiVersionDefault: '2024-02-15-preview'
};

export class AzureOpenAIProvider extends BaseProvider {
  constructor(model) {
    super('azure');
    this.model = model;
  }

  // Resolve the deployment + api-version endpoint from the declaration's config
  // knobs and the environment. Reading the declaration (rather than the module
  // constant) keeps the knobs single-sourced in the registered declaration.
  resolveEndpoint() {
    const cfg = lookup('azure')?.config || AZURE_CONFIG;
    const resource = process.env[cfg.resourceEnv];
    // Azure deployments are commonly named after the model they serve, so the
    // deployment defaults to the model when its env var is unset.
    const deployment = process.env[cfg.deploymentEnv] || this.model;
    const apiVersion = process.env[cfg.apiVersionEnv] || cfg.apiVersionDefault;
    if (!resource) {
      throw new Error(`Azure OpenAI resource not set. Set ${cfg.resourceEnv} environment variable.`);
    }
    return `https://${resource}.openai.azure.com/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  }

  async *stream(prompt) {
    // Resolve the API key lazily (dynamic import) rather than importing config.js
    // statically. This keeps provider modules out of config's static import graph,
    // so config.js can trigger the provider dir-scan without a circular import;
    // tests that mock config.js still intercept this dynamic import.
    const { getApiKey } = await import('../utils/config.js');
    const apiKey = getApiKey('azure');

    const response = await fetch(this.resolveEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Azure uses an `api-key` header, NOT `Authorization: Bearer`.
        'api-key': apiKey
      },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    await assertResponseOk(response, 'Azure OpenAI');

    // Stream body is OpenAI-shaped: SSE `data: ` lines, incremental text at
    // choices[0].delta.content, terminated by a `data: [DONE]` sentinel.
    for await (const line of readStreamLines(response)) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;

      try {
        const event = JSON.parse(data);
        const content = event.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {}
    }
  }
}

register({
  name: 'azure',
  Provider: AzureOpenAIProvider,
  config: { ...AZURE_CONFIG },
  capabilities: {
    auth: 'header',
    authHeader: 'api-key',
    endpoint: 'https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}',
    stream: { style: 'sse', terminator: '[DONE]' }
  }
});
