import { jest } from '@jest/globals';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tempDir = mkdtempSync(join(tmpdir(), 'arena-elo-int-'));
const eloPath = join(tempDir, 'elo.json');
mkdirSync(join(tempDir, 'battles'), { recursive: true });

jest.unstable_mockModule('../../src/utils/config.js', () => ({
  ELO_PATH: eloPath,
  ARENA_DIR: tempDir,
  BATTLES_DIR: join(tempDir, 'battles'),
  ensureArenaDir: () => {
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(join(tempDir, 'battles'), { recursive: true });
  },
  loadConfig: () => ({}),
  saveConfig: () => {},
  resolveAlias: () => ({}),
  getApiKey: () => null
}));

const { getRating, updateRatings, getAllRatings } = await import('../../src/elo/store.js');
const { calculateEloChange, DEFAULT_RATING } = await import('../../src/elo/calculator.js');

describe('ELO persistence integration', () => {
  beforeEach(() => {
    try { unlinkSync(eloPath); } catch {}
  });

  afterAll(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  test('fresh start: no elo.json, run battle creates it', () => {
    expect(existsSync(eloPath)).toBe(false);
    updateRatings('model-a', 'model-b', 1216, 1184, 'left');
    expect(existsSync(eloPath)).toBe(true);
    const store = JSON.parse(readFileSync(eloPath, 'utf-8'));
    expect(store.ratings['model-a'].elo).toBe(1216);
    expect(store.ratings['model-b'].elo).toBe(1184);
    expect(store.total_battles).toBe(1);
  });

  test('accumulation over 10 battles matches manual calculation', () => {
    let ratingA = DEFAULT_RATING;
    let ratingB = DEFAULT_RATING;

    for (let i = 0; i < 10; i++) {
      const winner = i % 3 === 0 ? 'left' : i % 3 === 1 ? 'right' : 'draw';
      const change = calculateEloChange(ratingA, ratingB, winner);
      updateRatings('model-a', 'model-b', change.newRatingA, change.newRatingB, winner);
      ratingA = change.newRatingA;
      ratingB = change.newRatingB;
    }

    const store = getAllRatings();
    expect(store.total_battles).toBe(10);
    expect(store.ratings['model-a'].elo).toBe(ratingA);
    expect(store.ratings['model-b'].elo).toBe(ratingB);
    const totalDelta = (store.ratings['model-a'].elo - DEFAULT_RATING) +
                       (store.ratings['model-b'].elo - DEFAULT_RATING);
    expect(totalDelta).toBe(0);
  });

  test('file survives restart: new store instance reads data', () => {
    updateRatings('model-x', 'model-y', 1300, 1100, 'left');
    const store = getAllRatings();
    expect(store.ratings['model-x'].elo).toBe(1300);
    expect(store.ratings['model-y'].elo).toBe(1100);
    expect(store.total_battles).toBe(1);
  });

  test('win/loss/draw counts after mixed results', () => {
    updateRatings('a', 'b', 1216, 1184, 'left');
    updateRatings('a', 'b', 1200, 1200, 'right');
    updateRatings('a', 'b', 1200, 1200, 'draw');
    updateRatings('a', 'b', 1216, 1184, 'left');

    const store = getAllRatings();
    expect(store.ratings.a.wins).toBe(2);
    expect(store.ratings.a.losses).toBe(1);
    expect(store.ratings.a.draws).toBe(1);
    expect(store.ratings.b.wins).toBe(1);
    expect(store.ratings.b.losses).toBe(2);
    expect(store.ratings.b.draws).toBe(1);
  });
});
