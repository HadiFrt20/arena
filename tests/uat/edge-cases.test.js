import { jest } from '@jest/globals';
import { mkdtempSync, rmSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tempDir = mkdtempSync(join(tmpdir(), 'arena-edge-'));
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
  resolveAlias: (alias) => ({ provider: 'mock', model: alias, alias }),
  getApiKey: () => 'fake-key'
}));

jest.unstable_mockModule('../../src/engine/streamer.js', () => ({
  streamModel: jest.fn()
}));

const { streamModel } = await import('../../src/engine/streamer.js');
const { runBattle } = await import('../../src/engine/runner.js');
const { calculateScore, determineWinner } = await import('../../src/engine/scorer.js');
const { getAllRatings } = await import('../../src/elo/store.js');

function makeMockProvider(name, model) {
  return { name, model, alias: model };
}

describe('edge cases UAT', () => {
  beforeEach(() => {
    try { unlinkSync(eloPath); } catch {}
    try { for (const f of readdirSync(battlesDir)) unlinkSync(join(battlesDir, f)); } catch {}
    jest.clearAllMocks();
  });

  afterAll(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  test('challenge with 1 test: battle works', async () => {
    const challenge = {
      id: 'one-test', title: 'One Test', category: 'algorithms', difficulty: 'easy',
      prompt: 'test', language: 'python',
      tests: [{ name: 'single', setup: '', run: 'result = 1 + 1', assert: 'result == 2' }],
      qualitative_checks: []
    };

    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      onToken('x = 1');
      return { code: 'x = 1', generation_time_ms: 500 };
    });

    const result = await runBattle(challenge,
      makeMockProvider('a', 'model-a'), makeMockProvider('b', 'model-b'),
      { onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn() }
    );

    expect(result.results.left.tests_total).toBe(1);
    expect(result.results.right.tests_total).toBe(1);
  });

  test('challenge with many tests (8): all run and report', async () => {
    const challenge = {
      id: 'many-tests', title: 'Many Tests', category: 'algorithms', difficulty: 'easy',
      prompt: 'test', language: 'python',
      tests: Array.from({ length: 8 }, (_, i) => ({
        name: `test-${i}`, setup: '', run: `result = ${i}`, assert: `result == ${i}`
      })),
      qualitative_checks: []
    };

    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      onToken('');
      return { code: '', generation_time_ms: 500 };
    });

    const result = await runBattle(challenge,
      makeMockProvider('a', 'model-a'), makeMockProvider('b', 'model-b'),
      { onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn() }
    );

    expect(result.results.left.tests_total).toBe(8);
    expect(result.results.left.tests_passed).toBe(8);
  });

  test('challenge with no qualitative checks: scoring still works', async () => {
    const challenge = {
      id: 'no-qual', title: 'No Qual', category: 'algorithms', difficulty: 'easy',
      prompt: 'test', language: 'python',
      tests: [{ name: 't1', setup: '', run: 'result = 1', assert: 'result == 1' }],
      qualitative_checks: []
    };

    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      onToken('x = 1');
      return { code: 'x = 1', generation_time_ms: 1000 };
    });

    const result = await runBattle(challenge,
      makeMockProvider('a', 'model-a'), makeMockProvider('b', 'model-b'),
      { onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn() }
    );

    expect(typeof result.scores.left).toBe('number');
    expect(typeof result.scores.right).toBe('number');
  });

  test('identical code from both models: draw', async () => {
    const code = 'def add(a, b):\n    return a + b';
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      onToken(code);
      return { code, generation_time_ms: 2000 };
    });

    const challenge = {
      id: 'dup-test', title: 'Dup Test', category: 'algorithms', difficulty: 'easy',
      prompt: 'test', language: 'python',
      tests: [{ name: 't1', setup: '', run: 'result = add(1, 2)', assert: 'result == 3' }],
      qualitative_checks: []
    };

    const result = await runBattle(challenge,
      makeMockProvider('a', 'model-a'), makeMockProvider('b', 'model-b'),
      { onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn() }
    );

    expect(result.winner).toBe('draw');
  });

  test('very fast battle: timing still captured', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      onToken('x = 1');
      return { code: 'x = 1', generation_time_ms: 50 };
    });

    const challenge = {
      id: 'fast-test', title: 'Fast', category: 'algorithms', difficulty: 'easy',
      prompt: 'test', language: 'python',
      tests: [{ name: 't1', setup: '', run: 'result = 1', assert: 'result == 1' }],
      qualitative_checks: []
    };

    const result = await runBattle(challenge,
      makeMockProvider('a', 'model-a'), makeMockProvider('b', 'model-b'),
      { onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn() }
    );

    expect(result.results.left.generation_time_ms).toBe(50);
    expect(result.results.right.generation_time_ms).toBe(50);
  });

  test('battle ID uniqueness: 20 rapid battles have unique IDs', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      onToken('x = 1');
      return { code: 'x = 1', generation_time_ms: 100 };
    });

    const challenge = {
      id: 'unique-test', title: 'Unique', category: 'algorithms', difficulty: 'easy',
      prompt: 'test', language: 'python',
      tests: [{ name: 't1', setup: '', run: 'result = 1', assert: 'result == 1' }],
      qualitative_checks: []
    };

    const ids = new Set();
    for (let i = 0; i < 20; i++) {
      const result = await runBattle(challenge,
        makeMockProvider('a', 'model-a'), makeMockProvider('b', 'model-b'),
        { onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn() }
      );
      ids.add(result.id);
    }

    expect(ids.size).toBe(20);
  });

  test('ELO after many battles stays reasonable', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      if (provider.model === 'winner') {
        const code = 'def f(): return 1';
        onToken(code);
        return { code, generation_time_ms: 1000 };
      }
      onToken('bad');
      return { code: 'bad', generation_time_ms: 2000 };
    });

    const challenge = {
      id: 'elo-test', title: 'ELO Test', category: 'algorithms', difficulty: 'easy',
      prompt: 'test', language: 'python',
      tests: [{ name: 't1', setup: '', run: 'result = f()', assert: 'result == 1' }],
      qualitative_checks: []
    };

    for (let i = 0; i < 30; i++) {
      await runBattle(challenge,
        makeMockProvider('a', 'winner'), makeMockProvider('b', 'loser'),
        { onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn() }
      );
    }

    const store = getAllRatings();
    expect(store.ratings.winner.elo).toBeGreaterThan(1200);
    expect(store.ratings.loser.elo).toBeLessThan(1200);
    expect(store.ratings.winner.elo).toBeLessThan(2000);
    expect(store.ratings.loser.elo).toBeGreaterThan(400);
    // Zero-sum
    const total = store.ratings.winner.elo + store.ratings.loser.elo;
    expect(total).toBe(2400);
  });

  test('challenge prompt with special characters passed correctly', async () => {
    let capturedPrompt = '';
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      capturedPrompt = prompt;
      onToken('x = 1');
      return { code: 'x = 1', generation_time_ms: 500 };
    });

    const challenge = {
      id: 'special-chars', title: 'Special "Chars" & <More>',
      category: 'algorithms', difficulty: 'easy',
      prompt: 'Write code that handles "quotes", \'apostrophes\', `backticks`, and $dollars',
      language: 'python',
      tests: [{ name: 't1', setup: '', run: 'result = 1', assert: 'result == 1' }],
      qualitative_checks: []
    };

    await runBattle(challenge,
      makeMockProvider('a', 'model-a'), makeMockProvider('b', 'model-b'),
      { onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn() }
    );

    expect(capturedPrompt).toContain('"quotes"');
    expect(capturedPrompt).toContain('$dollars');
    expect(capturedPrompt).toContain('`backticks`');
  });
});
