import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GoogleProvider } from './google.js';
import { OllamaProvider } from './ollama.js';

export function createProvider(resolved) {
  const { provider, model } = resolved;
  switch (provider) {
    case 'anthropic': return Object.assign(new AnthropicProvider(model), { alias: resolved.alias });
    case 'openai': return Object.assign(new OpenAIProvider(model), { alias: resolved.alias });
    case 'google': return Object.assign(new GoogleProvider(model), { alias: resolved.alias });
    case 'ollama': return Object.assign(new OllamaProvider(model), { alias: resolved.alias });
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}
