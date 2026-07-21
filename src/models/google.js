import { BaseProvider } from './provider.js';
import { register } from './registry.js';
import { readStreamLines, assertResponseOk } from '../utils/sse.js';

export class GoogleProvider extends BaseProvider {
  constructor(model) {
    super('google');
    this.model = model;
  }

  async *stream(prompt) {
    // Lazy config import — see the note in openai.js.
    const { getApiKey } = await import('../utils/config.js');
    const apiKey = getApiKey('google');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    await assertResponseOk(response, 'Google');

    for await (const line of readStreamLines(response)) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();

      try {
        const event = JSON.parse(data);
        const text = event.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch {}
    }
  }
}

register({
  name: 'google',
  Provider: GoogleProvider,
  config: { apiKeyEnv: 'GOOGLE_API_KEY' },
  capabilities: {
    auth: 'query',
    authParam: 'key',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse',
    stream: { style: 'sse', terminator: null }
  }
});
