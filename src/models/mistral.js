import { BaseProvider } from './provider.js';
import { register } from './registry.js';
import { readStreamLines, assertResponseOk } from '../utils/sse.js';

export class MistralProvider extends BaseProvider {
  constructor(model) {
    super('mistral');
    this.model = model;
  }

  async *stream(prompt) {
    // Resolve the API key lazily (dynamic import) rather than importing config.js
    // statically. This keeps provider modules out of config's static import graph,
    // so config.js can trigger the provider dir-scan without a circular import;
    // tests that mock config.js still intercept this dynamic import.
    const { getApiKey } = await import('../utils/config.js');
    const apiKey = getApiKey('mistral');

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    await assertResponseOk(response, 'Mistral');

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
  name: 'mistral',
  Provider: MistralProvider,
  config: { apiKeyEnv: 'MISTRAL_API_KEY' },
  capabilities: {
    auth: 'bearer',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    stream: { style: 'sse', terminator: '[DONE]' }
  }
});
