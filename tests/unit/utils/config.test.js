import { jest } from '@jest/globals';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

// We test the real config module but with controlled env
import { resolveAlias } from '../../../src/utils/config.js';

describe('config', () => {
  test('resolveAlias: claude resolves to anthropic provider', () => {
    const result = resolveAlias('claude');
    expect(result.provider).toBe('anthropic');
    expect(result.model).toContain('claude');
  });

  test('resolveAlias: direct provider:model format', () => {
    const result = resolveAlias('openai:gpt-4-turbo');
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4-turbo');
  });

  test('resolveAlias: unknown alias without colon throws', () => {
    expect(() => resolveAlias('totally-unknown')).toThrow(/Invalid model specifier/);
  });

  test('getApiKey returns env var value', async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key-from-env';
    try {
      const { getApiKey } = await import('../../../src/utils/config.js');
      const key = getApiKey('anthropic');
      expect(key).toBe('test-key-from-env');
    } finally {
      if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
      else delete process.env.ANTHROPIC_API_KEY;
    }
  });

  test('getApiKey throws when env var not set', async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const { getApiKey } = await import('../../../src/utils/config.js');
      expect(() => getApiKey('anthropic')).toThrow(/ANTHROPIC_API_KEY/);
    } finally {
      if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  test('ensureArenaDir creates ~/.arena directory', async () => {
    const { ensureArenaDir, ARENA_DIR } = await import('../../../src/utils/config.js');
    ensureArenaDir();
    expect(existsSync(ARENA_DIR)).toBe(true);
  });

  test('loadConfig creates default config if none exists', async () => {
    const { loadConfig } = await import('../../../src/utils/config.js');
    const config = loadConfig();
    expect(config).toHaveProperty('providers');
    expect(config).toHaveProperty('defaults');
    expect(config).toHaveProperty('aliases');
    expect(config.providers.anthropic).toBeDefined();
    expect(config.providers.openai).toBeDefined();
  });

  test('loadConfig reads existing config', async () => {
    const { loadConfig, CONFIG_PATH } = await import('../../../src/utils/config.js');
    const config = loadConfig();
    expect(config).toBeDefined();
    // Config file should exist on disk now
    expect(existsSync(CONFIG_PATH)).toBe(true);
  });
});
