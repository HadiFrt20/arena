import { BaseProvider } from './provider.js';
import { getApiKey } from '../utils/config.js';
import { readStreamLines, assertResponseOk } from '../utils/sse.js';

export class AnthropicProvider extends BaseProvider {
  constructor(model) {
    super('anthropic');
    this.model = model;
    this.apiKey = getApiKey('anthropic');
  }

  async *stream(prompt) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    await assertResponseOk(response, 'Anthropic');

    for await (const line of readStreamLines(response)) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;

      try {
        const event = JSON.parse(data);
        if (event.type === 'content_block_delta' && event.delta?.text) {
          yield event.delta.text;
        }
      } catch {}
    }
  }
}
