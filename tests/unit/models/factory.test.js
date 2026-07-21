import { jest } from '@jest/globals';

// Mock config so the providers' lazy `import('../utils/config.js')` (used inside
// stream()) never touches the real filesystem. The factory itself only reads
// the registry, which is populated by the real bootstrap dir-scan.
jest.unstable_mockModule('../../../src/utils/config.js', () => ({
  getApiKey: () => 'test-key',
  loadConfig: () => ({ providers: {} }),
  ensureArenaDir: () => {},
  ELO_PATH: '/tmp/elo.json',
  ARENA_DIR: '/tmp/.arena',
  BATTLES_DIR: '/tmp/.arena/battles'
}));

const { createProvider } = await import('../../../src/models/factory.js');
const { AnthropicProvider } = await import('../../../src/models/anthropic.js');
const { OpenAIProvider } = await import('../../../src/models/openai.js');
const { GoogleProvider } = await import('../../../src/models/google.js');
const { OllamaProvider } = await import('../../../src/models/ollama.js');

describe('createProvider (registry-backed)', () => {
  test('resolves each built-in provider to its class', () => {
    expect(createProvider({ provider: 'anthropic', model: 'm', alias: 'claude' }))
      .toBeInstanceOf(AnthropicProvider);
    expect(createProvider({ provider: 'openai', model: 'm', alias: 'gpt4o' }))
      .toBeInstanceOf(OpenAIProvider);
    expect(createProvider({ provider: 'google', model: 'm', alias: 'gemini' }))
      .toBeInstanceOf(GoogleProvider);
    expect(createProvider({ provider: 'ollama', model: 'm', alias: 'llama3' }))
      .toBeInstanceOf(OllamaProvider);
  });

  test('preserves the alias via Object.assign', () => {
    const p = createProvider({ provider: 'openai', model: 'gpt-4o', alias: 'gpt4o' });
    expect(p.alias).toBe('gpt4o');
    expect(p.model).toBe('gpt-4o');
  });

  test('unknown provider throws the exact "Unknown provider" message', () => {
    expect(() => createProvider({ provider: 'nope', model: 'm', alias: 'nope' }))
      .toThrow('Unknown provider: nope');
  });
});
