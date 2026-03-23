import { jest } from '@jest/globals';

// We need to mock the modules that runner.js imports before importing runner
// Since we're in ESM, we use jest.unstable_mockModule
jest.unstable_mockModule('../../../src/engine/streamer.js', () => ({
  streamModel: jest.fn()
}));
jest.unstable_mockModule('../../../src/engine/tester.js', () => ({
  runTests: jest.fn(),
  runQualitativeChecks: jest.fn()
}));
jest.unstable_mockModule('../../../src/elo/store.js', () => ({
  getRatings: jest.fn(() => [1200, 1200]),
  updateRatings: jest.fn(() => ({ ratings: {}, total_battles: 1, last_updated: new Date().toISOString() }))
}));
jest.unstable_mockModule('fs', () => ({
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn()
}));

const { streamModel } = await import('../../../src/engine/streamer.js');
const { runTests, runQualitativeChecks } = await import('../../../src/engine/tester.js');
const { getRatings, updateRatings } = await import('../../../src/elo/store.js');
const { writeFileSync } = await import('fs');
const { runBattle } = await import('../../../src/engine/runner.js');

function makeMockProvider(name, model) {
  return { name, model, alias: model, async *stream() { yield 'mock code'; } };
}

const simpleChallenge = {
  id: 'test-challenge',
  title: 'Test Challenge',
  language: 'python',
  prompt: 'Write something',
  tests: [{ name: 't1', setup: '', run: 'result = 1', assert: 'result == 1' }],
  qualitative_checks: []
};

describe('runner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      onToken('def add(a, b):\n    return a + b');
      return { code: 'def add(a, b):\n    return a + b', generation_time_ms: 2000 };
    });
    runTests.mockResolvedValue({
      tests_passed: 1,
      tests_total: 1,
      details: [{ name: 't1', passed: true, error: null }],
      execution_time_ms: 100
    });
    runQualitativeChecks.mockReturnValue({});
  });

  test('full battle flow: correct call order', async () => {
    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const callbacks = { onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn() };

    const result = await runBattle(simpleChallenge, left, right, callbacks);

    // streamModel called twice (once per provider)
    expect(streamModel).toHaveBeenCalledTimes(2);
    // runTests called twice
    expect(runTests).toHaveBeenCalledTimes(2);
    // runQualitativeChecks called twice
    expect(runQualitativeChecks).toHaveBeenCalledTimes(2);
    // ELO updated
    expect(getRatings).toHaveBeenCalledTimes(1);
    expect(updateRatings).toHaveBeenCalledTimes(1);
    // Battle file written
    expect(writeFileSync).toHaveBeenCalledTimes(1);
    // Status callbacks fired
    expect(callbacks.onStatus).toHaveBeenCalled();
  });

  test('left model errors: right still completes', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      if (provider.name === 'anthropic') {
        onToken('\n\n[ERROR: API failed]');
        return { code: '\n\n[ERROR: API failed]', generation_time_ms: 100 };
      }
      onToken('def add(a, b):\n    return a + b');
      return { code: 'def add(a, b):\n    return a + b', generation_time_ms: 2000 };
    });

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const result = await runBattle(simpleChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result).toBeDefined();
    expect(result.winner).toBeDefined();
    expect(result.results.left).toBeDefined();
    expect(result.results.right).toBeDefined();
  });

  test('both models error: declared draw or at least completes', async () => {
    streamModel.mockImplementation(async (provider, prompt, onToken) => {
      onToken('[ERROR]');
      return { code: '[ERROR]', generation_time_ms: 100 };
    });
    runTests.mockResolvedValue({
      tests_passed: 0, tests_total: 1,
      details: [{ name: 't1', passed: false, error: 'parse error' }],
      execution_time_ms: 0
    });

    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const result = await runBattle(simpleChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result).toBeDefined();
    // Both failed equally, should be draw
    expect(result.winner).toBe('draw');
  });

  test('battle result has all required fields', async () => {
    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const result = await runBattle(simpleChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('challenge');
    expect(result).toHaveProperty('models');
    expect(result).toHaveProperty('models.left');
    expect(result).toHaveProperty('models.right');
    expect(result).toHaveProperty('results.left');
    expect(result).toHaveProperty('results.right');
    expect(result).toHaveProperty('scores');
    expect(result).toHaveProperty('winner');
    expect(result).toHaveProperty('elo_delta');
    expect(result).toHaveProperty('integrity_hash');
    expect(result.id).toMatch(/^battle-/);
    expect(result.integrity_hash).toMatch(/^sha256:/);
  });

  test('battle ID is unique across calls', async () => {
    const left = makeMockProvider('anthropic', 'claude');
    const right = makeMockProvider('openai', 'gpt4o');
    const cbs = { onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn() };

    const r1 = await runBattle(simpleChallenge, left, right, cbs);
    const r2 = await runBattle(simpleChallenge, left, right, cbs);

    expect(r1.id).not.toBe(r2.id);
  });

  test('model info is captured in result', async () => {
    const left = makeMockProvider('anthropic', 'claude-sonnet');
    const right = makeMockProvider('openai', 'gpt-4o');
    const result = await runBattle(simpleChallenge, left, right, {
      onLeftToken: jest.fn(), onRightToken: jest.fn(), onStatus: jest.fn()
    });

    expect(result.models.left.provider).toBe('anthropic');
    expect(result.models.left.model).toBe('claude-sonnet');
    expect(result.models.right.provider).toBe('openai');
    expect(result.models.right.model).toBe('gpt-4o');
  });
});
