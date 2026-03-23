import { jest } from '@jest/globals';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Use a single temp dir for the whole suite (ELO_PATH is bound at import time)
const tempDir = mkdtempSync(join(tmpdir(), 'arena-store-test-'));
const eloPath = join(tempDir, 'elo.json');
mkdirSync(join(tempDir, 'battles'), { recursive: true });

jest.unstable_mockModule('../../../src/utils/config.js', () => ({
  ELO_PATH: eloPath,
  ARENA_DIR: tempDir,
  BATTLES_DIR: join(tempDir, 'battles'),
  ensureArenaDir: () => {
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(join(tempDir, 'battles'), { recursive: true });
  },
  loadConfig: () => ({})
}));

const { getRatings, updateRatings, getAllRatings } = await import('../../../src/elo/store.js');

describe('ELO store', () => {
  beforeEach(() => {
    // Clean elo.json between tests
    try { unlinkSync(eloPath); } catch {}
  });

  afterAll(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  test('create new store: getters return defaults', () => {
    const [rating] = getRatings(['new-model']);
    expect(rating).toBe(1200);
  });

  test('save and load: rating persisted to disk', () => {
    updateRatings('model-a', 'model-b', 1216, 1184, 'left');
    const raw = JSON.parse(readFileSync(eloPath, 'utf-8'));
    expect(raw.ratings['model-a'].elo).toBe(1216);
    expect(raw.ratings['model-b'].elo).toBe(1184);
  });

  test('multiple models stored and retrievable', () => {
    updateRatings('m1', 'm2', 1220, 1180, 'left');
    updateRatings('m3', 'm4', 1250, 1150, 'left');
    updateRatings('m5', 'm1', 1210, 1210, 'draw');

    const store = getAllRatings();
    expect(Object.keys(store.ratings)).toHaveLength(5);
    expect(store.ratings.m1).toBeDefined();
    expect(store.ratings.m3).toBeDefined();
    expect(store.ratings.m5).toBeDefined();
  });

  test('update existing model: latest value persisted', () => {
    updateRatings('m1', 'm2', 1216, 1184, 'left');
    updateRatings('m1', 'm2', 1230, 1170, 'left');

    const [rating] = getRatings(['m1']);
    expect(rating).toBe(1230);
  });

  test('win/loss/draw counters increment correctly', () => {
    updateRatings('m1', 'm2', 1216, 1184, 'left');
    updateRatings('m1', 'm2', 1200, 1200, 'right');
    updateRatings('m1', 'm2', 1200, 1200, 'draw');

    const store = getAllRatings();
    expect(store.ratings.m1.wins).toBe(1);
    expect(store.ratings.m1.losses).toBe(1);
    expect(store.ratings.m1.draws).toBe(1);
    expect(store.ratings.m2.wins).toBe(1);
    expect(store.ratings.m2.losses).toBe(1);
    expect(store.ratings.m2.draws).toBe(1);
  });

  test('corrupt file handling: recovers gracefully', () => {
    writeFileSync(eloPath, 'not valid json {{{');
    // Should recover to defaults instead of throwing
    const [rating] = getRatings(['model']);
    expect(rating).toBe(1200);
  });

  test('rapid updates: last write wins', () => {
    for (let i = 0; i < 10; i++) {
      updateRatings('m1', 'm2', 1200 + i, 1200 - i, 'left');
    }
    const store = getAllRatings();
    expect(store.ratings.m1.elo).toBe(1209);
    expect(store.ratings.m2.elo).toBe(1191);
  });

  test('total_battles counter increments', () => {
    updateRatings('m1', 'm2', 1216, 1184, 'left');
    updateRatings('m1', 'm2', 1230, 1170, 'left');
    updateRatings('m1', 'm2', 1220, 1180, 'right');

    const store = getAllRatings();
    expect(store.total_battles).toBe(3);
  });

  test('last_updated timestamp updates on each write', () => {
    updateRatings('m1', 'm2', 1216, 1184, 'left');
    const store = getAllRatings();
    expect(store.last_updated).toBeTruthy();
    const ts = new Date(store.last_updated);
    expect(ts.getTime()).toBeGreaterThan(Date.now() - 5000);
    expect(ts.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('getAllRatings returns empty store when no file', () => {
    const store = getAllRatings();
    expect(store.ratings).toEqual({});
    expect(store.total_battles).toBe(0);
    expect(store.last_updated).toBeNull();
  });
});
