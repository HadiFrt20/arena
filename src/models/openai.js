import { BaseProvider } from './provider.js';
import { getApiKey } from '../utils/config.js';
import { readStreamLines, assertResponseOk } from '../utils/sse.js';

export class OpenAIProvider extends BaseProvider {
  constructor(model) {
    super('openai');
    this.model = model;
    this.apiKey = getApiKey('openai');
  }

  async *stream(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    await assertResponseOk(response, 'OpenAI');

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
