import { jest } from '@jest/globals';

let mockConfig = {
  global_leaderboard: {
    enabled: true,
    endpoint: 'https://arena-api.example.com',
    anonymous_id: 'test-id-123'
  }
};

jest.unstable_mockModule('../../../src/utils/config.js', () => ({
  loadConfig: () => mockConfig,
  ensureArenaDir: () => {},
  ELO_PATH: '/tmp/test-elo.json',
  ARENA_DIR: '/tmp/test-arena',
  BATTLES_DIR: '/tmp/test-arena/battles'
}));

const { publishBattle, fetchLeaderboard } = await import('../../../src/elo/publisher.js');

const sampleBattle = {
  id: 'battle-2026-01-01-001',
  models: { left: { model: 'claude' }, right: { model: 'gpt4o' } },
  results: { left: {}, right: {} },
  winner: 'left',
  integrity_hash: 'sha256:abc123'
};

describe('publisher', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockConfig = {
      global_leaderboard: {
        enabled: true,
        endpoint: 'https://arena-api.example.com',
        anonymous_id: 'test-id-123'
      }
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('successful publish: returns response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });

    const result = await publishBattle(sampleBattle);
    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://arena-api.example.com/api/battles',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
    // Verify body includes anonymous_id
    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(callBody.anonymous_id).toBe('test-id-123');
  });

  test('API down (500): graceful error message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error')
    });

    await expect(publishBattle(sampleBattle)).rejects.toThrow('Failed to publish');
  });

  test('network timeout: rejects with error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('request timed out'));
    await expect(publishBattle(sampleBattle)).rejects.toThrow('request timed out');
  });

  test('rate limited (429): appropriate message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited')
    });

    await expect(publishBattle(sampleBattle)).rejects.toThrow('Failed to publish');
  });

  test('payload includes battle data and integrity hash', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });

    await publishBattle(sampleBattle);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.id).toBe('battle-2026-01-01-001');
    expect(body.integrity_hash).toBe('sha256:abc123');
    expect(body.models).toBeDefined();
    expect(body.results).toBeDefined();
  });

  test('global leaderboard disabled: throws error', async () => {
    mockConfig.global_leaderboard.enabled = false;
    await expect(publishBattle(sampleBattle)).rejects.toThrow('not enabled');
  });

  test('fetchLeaderboard success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ratings: { claude: { elo: 1300 } } })
    });

    const result = await fetchLeaderboard();
    expect(result.ratings.claude.elo).toBe(1300);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://arena-api.example.com/api/leaderboard'
    );
  });

  test('fetchLeaderboard API down: rejects', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      statusText: 'Service Unavailable'
    });

    await expect(fetchLeaderboard()).rejects.toThrow('Failed to fetch leaderboard');
  });
});
