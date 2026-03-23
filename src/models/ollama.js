import { BaseProvider } from './provider.js';
import { loadConfig } from '../utils/config.js';
import { readStreamLines, assertResponseOk } from '../utils/sse.js';

export class OllamaProvider extends BaseProvider {
  constructor(model) {
    super('ollama');
    this.model = model;
    const config = loadConfig();
    this.baseUrl = config.providers?.ollama?.base_url || 'http://localhost:11434';
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
