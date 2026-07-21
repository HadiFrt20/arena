import { jest } from '@jest/globals';

// Pins the missing-API-key surface: createProvider() must fail fast (throw the
// config layer's "API key not found" error) for a key-auth provider whose env
// var is unset — exactly as main did when the provider constructor resolved the
// key. This is what lets battle.js print a clean message and exit(1) BEFORE the
// battle UI starts, rather than surfacing the failure as an inline
// "[ERROR: ...]" token mid-stream.
jest.unstable_mockModule('../../../src/utils/config.js', () => ({
  getApiKey: (name) => {
    // Key-auth providers throw when unset; non-key providers (ollama) return null.
    if (name === 'ollama') return null;
    throw new Error(`API key not found. Set ${name.toUpperCase()}_API_KEY environment variable.`);
  },
  loadConfig: () => ({ providers: { ollama: { base_url: 'http://localhost:11434' } } }),
  ensureArenaDir: () => {},
  ELO_PATH: '/tmp/elo.json',
  ARENA_DIR: '/tmp/.arena',
  BATTLES_DIR: '/tmp/.arena/battles'
}));

const { createProvider } = await import('../../../src/models/factory.js');

describe('createProvider missing-key fail-fast', () => {
  test('key-auth provider with unset key throws from createProvider', () => {
    expect(() => createProvider({ provider: 'openai', model: 'gpt-4o', alias: 'gpt4o' }))
      .toThrow(/API key not found/);
    expect(() => createProvider({ provider: 'anthropic', model: 'm', alias: 'claude' }))
      .toThrow(/API key not found/);
  });

  test('non-key provider (ollama) still constructs without a key', () => {
    const p = createProvider({ provider: 'ollama', model: 'llama3.3', alias: 'llama3' });
    expect(p.constructor.name).toBe('OllamaProvider');
    expect(p.alias).toBe('llama3');
  });
});
