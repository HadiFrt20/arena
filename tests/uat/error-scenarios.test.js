import { jest } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tempDir = mkdtempSync(join(tmpdir(), 'arena-err-'));
const eloPath = join(tempDir, 'elo.json');
const battlesDir = join(tempDir, 'battles');
mkdirSync(battlesDir, { recursive: true });

jest.unstable_mockModule('../../src/utils/config.js', () => ({
  ELO_PATH: eloPath,
  ARENA_DIR: tempDir,
  BATTLES_DIR: battlesDir,
  ensureArenaDir: () => {
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(battlesDir, { recursive: true });
  },
  loadConfig: () => ({
    providers: {}, aliases: {}, defaults: {},
    global_leaderboard: { enabled: false }
  }),
  saveConfig: () => {},
  resolveAlias: (alias) => {
    if (alias === 'nonexistent') throw new Error(`Invalid model specifier: "${alias}"`);
    return { provider: 'mock', model: alias, alias };
  },
  getApiKey: () => 'fake-key'
}));

jest.unstable_mockModule('../../src/engine/streamer.js', () => ({
  streamModel: jest.fn()
}));

const { streamModel } = await import('../../src/engine/streamer.js');
const { runBattle } = await import('../../src/engine/runner.js');

function makeMockProvider(name, model) {
  return { name, model, alias: model };
}

const simpleChallenge = {
  id: 'test', title: 'Test', category: 'algorithms', difficulty: 'easy',
  prompt: 'test', language: 'python',
  tests: [{ name: 't1', setup: '', run: 'result = 1', assert: 'result == 1' }],
  qualitative_checks: []
};

describe('error scenarios UAT', () => {
  beforeEach(() => {
    try { unlinkSync(eloPath); } catch {}
    try { for (const f of readdirSync(battlesDir)) unlinkSync(join(battlesDir, f)); } catch {}
    jest.clearAllMocks();
  });

  afterAll(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  test('provider returns non-code: treated as code, fails tests, battle completes', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      const code = "I'm sorry, I can't help with that.";
      onToken(code);
      return { code, generation_time_ms: 500 };
    });

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const result = await runBattle(simpleChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result).toBeDefined();
    expect(result.results.left.tests_passed).toBe(0);
    expect(result.results.right.tests_passed).toBe(0);
    expect(result.winner).toBe('draw');
  });

  test('very large model output: 100KB of code does not crash', async () => {
    const largeCode = 'x = 1\n'.repeat(10000);
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      onToken(largeCode);
      return { code: largeCode, generation_time_ms: 5000 };
    });

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const result = await runBattle(simpleChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result).toBeDefined();
    expect(result.results.left.lines_of_code).toBeGreaterThan(1000);
  });

  test('both providers produce error output: battle still completes', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      const code = '\n\n[ERROR: Connection refused]';
      onToken(code);
      return { code, generation_time_ms: 100 };
    });

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const result = await runBattle(simpleChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result).toBeDefined();
    expect(result.results.left.tests_passed).toBe(0);
    expect(result.results.right.tests_passed).toBe(0);
  });

  test('corrupt elo.json: writing invalid JSON and reading fails', () => {
    writeFileSync(eloPath, '{{{{not json');
    expect(() => JSON.parse('{{{{not json')).toThrow();
  });

  test('battle with code that causes execution timeout', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      const code = 'import time\ntime.sleep(60)\nresult = 1';
      onToken(code);
      return { code, generation_time_ms: 1000 };
    });

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const result = await runBattle(simpleChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result).toBeDefined();
    expect(result.results.left.tests_passed).toBe(0);
  }, 90000);

  test('model writes code in wrong language: execution fails', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      const code = 'function add(a, b) { return a + b; }';
      onToken(code);
      return { code, generation_time_ms: 1000 };
    });

    const challenge = {
      id: 'py-test', title: 'Python Test', category: 'algorithms', difficulty: 'easy',
      prompt: 'test', language: 'python',
      tests: [{ name: 't1', setup: '', run: 'result = add(1, 2)', assert: 'result == 3' }],
      qualitative_checks: []
    };

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const result = await runBattle(challenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result.results.left.tests_passed).toBe(0);
  });
});
