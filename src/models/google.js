import { BaseProvider } from './provider.js';
import { getApiKey } from '../utils/config.js';
import { readStreamLines, assertResponseOk } from '../utils/sse.js';

export class GoogleProvider extends BaseProvider {
  constructor(model) {
    super('google');
    this.model = model;
    this.apiKey = getApiKey('google');
  }

  async *stream(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

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
