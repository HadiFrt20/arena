import { jest } from '@jest/globals';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tempDir = mkdtempSync(join(tmpdir(), 'arena-uat-'));
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
    providers: { anthropic: { api_key_env: 'ANTHROPIC_API_KEY' }, openai: { api_key_env: 'OPENAI_API_KEY' } },
    aliases: { claude: 'anthropic:claude-sonnet-4-20250514', gpt4o: 'openai:gpt-4o' },
    defaults: { left: 'claude', right: 'gpt4o', language: 'python' },
    global_leaderboard: { enabled: false }
  }),
  saveConfig: () => {},
  resolveAlias: (alias) => {
    const map = {
      claude: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', alias: 'claude' },
      gpt4o: { provider: 'openai', model: 'gpt-4o', alias: 'gpt4o' }
    };
    if (map[alias]) return map[alias];
    if (alias.includes(':')) {
      const [p, ...m] = alias.split(':');
      return { provider: p, model: m.join(':'), alias };
    }
    throw new Error(`Invalid model specifier: "${alias}"`);
  },
  getApiKey: () => 'fake-key'
}));

jest.unstable_mockModule('../../src/engine/streamer.js', () => ({
  streamModel: jest.fn()
}));

const { streamModel } = await import('../../src/engine/streamer.js');
const { runBattle } = await import('../../src/engine/runner.js');
const { getChallenge, getRandomChallenge } = await import('../../src/challenges/index.js');

function makeMockProvider(name, model, alias) {
  return { name, model, alias: alias || model };
}

describe('full battle UAT', () => {
  beforeEach(() => {
    try { unlinkSync(eloPath); } catch {}
    try { for (const f of readdirSync(battlesDir)) unlinkSync(join(battlesDir, f)); } catch {}
    jest.clearAllMocks();
  });

  afterAll(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  test('battle with fizzbuzz: runs to completion, has winner/draw, battle file written', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      let code;
      if (provider.model.includes('claude')) {
        code = "def fizzbuzz(n):\n    return ['FizzBuzz' if i%15==0 else 'Fizz' if i%3==0 else 'Buzz' if i%5==0 else str(i) for i in range(1, n+1)]";
      } else {
        code = "def fizzbuzz(n):\n    result = []\n    for i in range(1, n+1):\n        if i % 15 == 0: result.append('FizzBuzz')\n        elif i % 3 == 0: result.append('Fizz')\n        elif i % 5 == 0: result.append('Buzz')\n        else: result.append(str(i))\n    return result";
      }
      onToken(code);
      return { code, generation_time_ms: provider.model.includes('claude') ? 1500 : 2500 };
    });

    const challenge = getChallenge('fizzbuzz');
    const left = makeMockProvider('anthropic', 'claude-sonnet-4-20250514', 'claude');
    const right = makeMockProvider('openai', 'gpt-4o', 'gpt4o');
    const statusMsgs = [];

    const result = await runBattle(challenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: (s) => statusMsgs.push(s)
    });

    expect(result).toBeDefined();
    expect(['left', 'right', 'draw']).toContain(result.winner);
    expect(result.results.left.tests_passed).toBe(5);
    expect(result.results.right.tests_passed).toBe(5);

    const files = readdirSync(battlesDir);
    expect(files.length).toBe(1);
    expect(statusMsgs.length).toBeGreaterThan(0);
  });

  test('battle with random challenge works', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      const code = 'x = 1';
      onToken(code);
      return { code, generation_time_ms: 1000 };
    });

    const challenge = getRandomChallenge();
    const left = makeMockProvider('anthropic', 'claude-test', 'claude');
    const right = makeMockProvider('openai', 'gpt-test', 'gpt4o');

    const result = await runBattle(challenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result).toBeDefined();
    expect(result.challenge).toBe(challenge.id);
  });

  test('battle with custom challenge file', async () => {
    const customChallenge = {
      id: 'custom-multiply', title: 'Multiply', category: 'algorithms', difficulty: 'easy',
      prompt: 'Write multiply(a,b)', language: 'python',
      tests: [{ name: 'basic', setup: '', run: 'result = multiply(3, 4)', assert: 'result == 12' }],
      qualitative_checks: []
    };

    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      const code = 'def multiply(a, b): return a * b';
      onToken(code);
      return { code, generation_time_ms: 500 };
    });

    const left = makeMockProvider('anthropic', 'claude-test', 'claude');
    const right = makeMockProvider('openai', 'gpt-test', 'gpt4o');

    const result = await runBattle(customChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result.results.left.tests_passed).toBe(1);
    expect(result.results.right.tests_passed).toBe(1);
  });

  test('battle output has all expected sections', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      const code = 'def add(a, b):\n    return a + b';
      onToken(code);
      return { code, generation_time_ms: 2000 };
    });

    const challenge = {
      id: 'test', title: 'Test', category: 'algorithms', difficulty: 'easy',
      prompt: 'test', language: 'python',
      tests: [{ name: 't1', setup: '', run: 'result = add(1,2)', assert: 'result == 3' }],
      qualitative_checks: []
    };

    const left = makeMockProvider('anthropic', 'claude-test', 'claude');
    const right = makeMockProvider('openai', 'gpt-test', 'gpt4o');

    const result = await runBattle(challenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result.challenge).toBe('test');
    expect(result.models.left.alias).toBe('claude');
    expect(result.models.right.alias).toBe('gpt4o');
    expect(typeof result.scores.left).toBe('number');
    expect(typeof result.scores.right).toBe('number');
    expect(result.results.left.test_details).toBeDefined();
    expect(result.results.right.test_details).toBeDefined();
  });
});
