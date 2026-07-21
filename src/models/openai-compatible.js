import { BaseProvider } from './provider.js';
import { loadConfig, getApiKey } from '../utils/config.js';
import { readStreamLines, assertResponseOk } from '../utils/sse.js';

export class OpenAICompatibleProvider extends BaseProvider {
  constructor(model) {
    super('openai-compatible');
    this.model = model;
    const config = loadConfig();
    this.baseUrl = config.providers?.['openai-compatible']?.base_url;
    // Tolerate keyless setups: local endpoints (LM Studio, vLLM) often need no key.
    // getApiKey throws when api_key_env is configured but unset — swallow that here.
    try {
      this.apiKey = getApiKey('openai-compatible');
    } catch {
      this.apiKey = null;
    }
  }

  async *stream(prompt) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    await assertResponseOk(response, 'OpenAI-compatible');

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
