import { jest } from '@jest/globals';
import { BaseProvider } from '../../../src/models/provider.js';
import { resolveAlias } from '../../../src/utils/config.js';

describe('BaseProvider', () => {
  test('stream() throws not-implemented', async () => {
    const provider = new BaseProvider('test');
    const iterator = provider.stream('prompt');
    await expect(iterator.next()).rejects.toThrow('not implemented');
  });

  test('has name property', () => {
    const provider = new BaseProvider('my-provider');
    expect(provider.name).toBe('my-provider');
  });
});

describe('resolveAlias', () => {
  test('"claude" resolves to anthropic provider + model', () => {
    const resolved = resolveAlias('claude');
    expect(resolved.provider).toBe('anthropic');
    expect(resolved.model).toContain('claude');
  });

  test('"gpt4o" resolves to openai provider + model', () => {
    const resolved = resolveAlias('gpt4o');
    expect(resolved.provider).toBe('openai');
    expect(resolved.model).toBe('gpt-4o');
  });

  test('unknown alias with no colon throws meaningful error', () => {
    expect(() => resolveAlias('nonexistent')).toThrow();
  });

  test('all known aliases resolve without error', () => {
    const aliases = ['claude', 'claude-opus', 'gpt4o', 'gpt5', 'gemini', 'llama3', 'deepseek'];
    for (const alias of aliases) {
      const resolved = resolveAlias(alias);
      expect(resolved.provider).toBeTruthy();
      expect(resolved.model).toBeTruthy();
    }
  });

  test('direct provider:model format works', () => {
    const resolved = resolveAlias('anthropic:claude-3-haiku');
    expect(resolved.provider).toBe('anthropic');
    expect(resolved.model).toBe('claude-3-haiku');
  });
});
