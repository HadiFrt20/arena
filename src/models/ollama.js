import { BaseProvider } from './provider.js';
import { register, lookup } from './registry.js';
import { readStreamLines, assertResponseOk } from '../utils/sse.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';

export class OllamaProvider extends BaseProvider {
  constructor(model) {
    super('ollama');
    this.model = model;
    // Seed with the default from this provider's own registry declaration — a
    // synchronous read, so the constructor needs no config import and creates no
    // circular import. The actual request URL is resolved lazily in stream()
    // (see resolveBaseUrl) so a user override persisted in ~/.arena/config wins.
    this.baseUrl = lookup('ollama')?.config?.baseUrlDefault || DEFAULT_BASE_URL;
  }

  // Resolve the base URL through the config layer, exactly as main did: a user
  // override in loadConfig().providers.ollama.base_url wins, otherwise the
  // registry declaration's baseUrlDefault (already reflected into the derived
  // config) is used. loadConfig is imported LAZILY so ollama stays out of
  // config's static import graph and the registry bootstrap has no cycle.
  async resolveBaseUrl() {
    const { loadConfig } = await import('../utils/config.js');
    const override = loadConfig().providers?.ollama?.base_url;
    return override || this.baseUrl;
  }

  async *stream(prompt) {
    const baseUrl = await this.resolveBaseUrl();
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: true
      })
    });

    await assertResponseOk(response, 'Ollama');

    for await (const line of readStreamLines(response)) {
      try {
        const event = JSON.parse(line);
        if (event.response) yield event.response;
      } catch {}
    }
  }
}

register({
  name: 'ollama',
  Provider: OllamaProvider,
  config: { baseUrlDefault: DEFAULT_BASE_URL },
  capabilities: {
    auth: 'none',
    endpoint: '{base_url}/api/generate',
    stream: { style: 'ndjson', terminator: null }
  }
});
