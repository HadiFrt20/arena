import { BaseProvider } from './provider.js';
import { register } from './registry.js';
import { readStreamLines, assertResponseOk } from '../utils/sse.js';

export class CohereProvider extends BaseProvider {
  constructor(model) {
    super('cohere');
    this.model = model;
  }

  async *stream(prompt) {
    // Resolve the API key lazily (dynamic import) rather than importing config.js
    // statically. This keeps provider modules out of config's static import graph,
    // so config.js can trigger the provider dir-scan without a circular import;
    // tests that mock config.js still intercept this dynamic import.
    const { getApiKey } = await import('../utils/config.js');
    const apiKey = getApiKey('cohere');

    const response = await fetch('https://api.cohere.com/v2/chat', {
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

    await assertResponseOk(response, 'Cohere');

    // Cohere v2 /chat streams SSE-style JSON events discriminated by a `type`
    // field. There is NO `[DONE]` sentinel: text arrives on `content-delta`
    // events (token at delta.message.content.text) and the stream terminates on
    // a `message-end` event. All other event types (message-start,
    // content-start, content-end, ...) are ignored.
    for await (const line of readStreamLines(response)) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data) continue;

      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }

      if (event.type === 'message-end') return;
      if (event.type === 'content-delta') {
        const text = event.delta?.message?.content?.text;
        if (text) yield text;
      }
    }
  }
}

register({
  name: 'cohere',
  Provider: CohereProvider,
  config: { apiKeyEnv: 'CO_API_KEY' },
  capabilities: {
    auth: 'bearer',
    endpoint: 'https://api.cohere.com/v2/chat',
    // Cohere v2 /chat has NO `[DONE]` sentinel: the stream is terminated by a
    // `message-end` event (see stream() above). Declaring it here — rather than
    // a bare null — lets `arena providers`, the docs generator, and the registry
    // integration test distinguish message-end termination from a plain
    // stream-close (huggingface/ollama), all data-driven off this declaration.
    stream: { style: 'sse', terminator: 'message-end' }
  }
});
