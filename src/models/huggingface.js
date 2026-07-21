import { BaseProvider } from './provider.js';
import { register } from './registry.js';
import { readStreamLines, assertResponseOk } from '../utils/sse.js';

export class HuggingFaceProvider extends BaseProvider {
  constructor(model) {
    super('huggingface');
    this.model = model;
  }

  async *stream(prompt) {
    // Resolve the API key lazily (dynamic import) rather than importing config.js
    // statically. This keeps provider modules out of config's static import graph,
    // so config.js can trigger the provider dir-scan without a circular import;
    // tests that mock config.js still intercept this dynamic import.
    const { getApiKey } = await import('../utils/config.js');
    const apiKey = getApiKey('huggingface');

    const response = await fetch(`https://api-inference.huggingface.co/models/${this.model}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {},
        stream: true
      })
    });

    // HF uses 503 for cold model loading, alongside 401/429/etc. — all surface
    // as an error.
    await assertResponseOk(response, 'HuggingFace');

    // HF text-generation-inference (TGI) streams SSE `data: ` lines, each a JSON
    // object carrying a `token` object; the incremental text is at token.text.
    // There is NO `[DONE]` sentinel — the stream ends when the body closes. The
    // final event may also carry an aggregated `generated_text` field; we ignore
    // it and emit only the per-token increments.
    for await (const line of readStreamLines(response)) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(line.indexOf(':') + 1).trim();
      if (!data) continue;

      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }

      const text = event.token?.text;
      if (text) yield text;
    }
  }
}

register({
  name: 'huggingface',
  Provider: HuggingFaceProvider,
  config: { apiKeyEnv: 'HF_API_TOKEN' },
  capabilities: {
    auth: 'bearer',
    endpoint: 'https://api-inference.huggingface.co/models/{model}',
    stream: { style: 'sse', terminator: null }
  }
});
