import { jest } from '@jest/globals';
import { mkdtempSync, readFileSync, existsSync, rmSync, readdirSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tempDir = mkdtempSync(join(tmpdir(), 'arena-battle-test-'));
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
  loadConfig: () => ({ providers: {}, aliases: {}, defaults: {} }),
  saveConfig: () => {},
  resolveAlias: (alias) => ({ provider: 'mock', model: alias, alias }),
  getApiKey: () => 'fake-key'
}));

jest.unstable_mockModule('../../src/engine/streamer.js', () => ({
  streamModel: jest.fn()
}));

const { streamModel } = await import('../../src/engine/streamer.js');
const { runBattle } = await import('../../src/engine/runner.js');
const { getAllRatings } = await import('../../src/elo/store.js');

function makeMockProvider(name, model) {
  return { name, model, alias: model };
}

const simpleChallenge = {
  id: 'simple-add',
  title: 'Add Two Numbers',
  category: 'algorithms',
  difficulty: 'easy',
  prompt: 'Write add(a,b)',
  language: 'python',
  tests: [
    { name: 'basic', setup: '', run: 'result = add(2, 3)', assert: 'result == 5' },
    { name: 'negative', setup: '', run: 'result = add(-1, -1)', assert: 'result == -2' },
    { name: 'zero', setup: '', run: 'result = add(0, 0)', assert: 'result == 0' }
  ],
  qualitative_checks: [
    { id: 'type-hints', patterns: ['def .+\\(.*:.*\\).*->'] }
  ]
};

describe('battle flow integration', () => {
  beforeEach(() => {
    // Clean up between tests
    try { unlinkSync(eloPath); } catch {}
    try {
      for (const f of readdirSync(battlesDir)) unlinkSync(join(battlesDir, f));
    } catch {}
    jest.clearAllMocks();
  });

  afterAll(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  test('full battle with mock providers: complete pipeline', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      const code = 'def add(a, b):\n    return a + b';
      onToken(code);
      return { code, generation_time_ms: 2000 };
    });

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const result = await runBattle(simpleChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result.results.left.tests_passed).toBe(3);
    expect(result.results.right.tests_passed).toBe(3);
    expect(result.winner).toBe('draw');
    expect(result.integrity_hash).toMatch(/^sha256:/);
  });

  test('battle result file is written to disk', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      const code = 'def add(a, b):\n    return a + b';
      onToken(code);
      return { code, generation_time_ms: 2000 };
    });

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const result = await runBattle(simpleChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    const files = readdirSync(battlesDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^battle-.*\.json$/);

    const saved = JSON.parse(readFileSync(join(battlesDir, files[0]), 'utf-8'));
    expect(saved.id).toBe(result.id);
    expect(saved.challenge).toBe('simple-add');
  });

  test('ELO file is updated after battle', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      const code = 'def add(a, b):\n    return a + b';
      onToken(code);
      return { code, generation_time_ms: 2000 };
    });

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    await runBattle(simpleChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(existsSync(eloPath)).toBe(true);
    const store = getAllRatings();
    expect(store.total_battles).toBe(1);
    expect(store.ratings.claude).toBeDefined();
    expect(store.ratings.gpt4o).toBeDefined();
  });

  test('battle with one provider returning bad code', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      if (provider.name === 'anthropic') {
        const code = 'def add(a, b):\n    return a + b';
        onToken(code);
        return { code, generation_time_ms: 2000 };
      }
      const code = "I'm sorry, I cannot help with that.";
      onToken(code);
      return { code, generation_time_ms: 1500 };
    });

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const result = await runBattle(simpleChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result.results.left.tests_passed).toBe(3);
    expect(result.results.right.tests_passed).toBe(0);
    expect(result.winner).toBe('left');
  });

  test('sequential battles accumulate ELO correctly', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      if (provider.model === 'claude') {
        const code = 'def add(a, b):\n    return a + b';
        onToken(code);
        return { code, generation_time_ms: 1500 };
      }
      const code = 'def add(a, b):\n    return a - b';
      onToken(code);
      return { code, generation_time_ms: 3000 };
    });

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const cbs = { onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn() };

    await runBattle(simpleChallenge, left, right, cbs);
    await runBattle(simpleChallenge, left, right, cbs);
    await runBattle(simpleChallenge, left, right, cbs);

    const store = getAllRatings();
    expect(store.total_battles).toBe(3);
    expect(store.ratings.claude.elo).toBeGreaterThan(1200);
    expect(store.ratings.gpt4o.elo).toBeLessThan(1200);
    expect(store.ratings.claude.wins).toBe(3);
    expect(store.ratings.gpt4o.losses).toBe(3);
  });

  test('battle with JavaScript challenge', async () => {
    const jsChallenge = {
      id: 'js-add', title: 'JS Add', category: 'algorithms', difficulty: 'easy',
      prompt: 'Write add function', language: 'javascript',
      tests: [{ name: 'basic', setup: '', run: 'result = add(2, 3)', assert: 'result === 5' }],
      qualitative_checks: []
    };

    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      const code = 'function add(a, b) { return a + b; }';
      onToken(code);
      return { code, generation_time_ms: 1000 };
    });

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const result = await runBattle(jsChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result.results.left.tests_passed).toBe(1);
    expect(result.results.right.tests_passed).toBe(1);
  });

  test('markdown fences are stripped from model output', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      const code = '```python\ndef add(a, b):\n    return a + b\n```';
      onToken(code);
      return { code, generation_time_ms: 2000 };
    });

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const result = await runBattle(simpleChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result.results.left.tests_passed).toBe(3);
  });
});
