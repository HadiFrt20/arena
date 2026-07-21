import { BaseProvider } from './provider.js';
import { register, lookup } from './registry.js';
import { readStreamLines, assertResponseOk } from '../utils/sse.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';

export class OllamaProvider extends BaseProvider {
  constructor(model) {
    super('ollama');
    this.model = model;
    // Base URL comes from this provider's own registry declaration (a
    // synchronous read, so no config import is needed in the constructor and no
    // circular import is created). A user override persisted in ~/.arena/config
    // is layered on by loadConfig(); createProvider() passes an already-resolved
    // model, and the default matches the derived config value.
    this.baseUrl = lookup('ollama')?.config?.baseUrlDefault || DEFAULT_BASE_URL;
  }

  async *stream(prompt) {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
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
