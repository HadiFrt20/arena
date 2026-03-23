import { jest } from '@jest/globals';
import { hashBattle } from '../../../src/utils/hash.js';

const sampleBattle = {
  challenge: 'fizzbuzz',
  models: { left: { model: 'claude' }, right: { model: 'gpt4o' } },
  results: { left: { tests_passed: 5 }, right: { tests_passed: 3 } },
  winner: 'left'
};

describe('hash', () => {
  test('deterministic: same input produces same hash', () => {
    const hash1 = hashBattle(sampleBattle);
    const hash2 = hashBattle(sampleBattle);
    expect(hash1).toBe(hash2);
  });

  test('different inputs produce different hashes', () => {
    const hash1 = hashBattle(sampleBattle);
    const hash2 = hashBattle({ ...sampleBattle, winner: 'right' });
    expect(hash1).not.toBe(hash2);
  });

  test('hash format is sha256:hex_string', () => {
    const hash = hashBattle(sampleBattle);
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test('handles large input without issue', () => {
    const largeBattle = {
      challenge: 'test',
      models: { left: { model: 'a' }, right: { model: 'b' } },
      results: { left: { code: 'x'.repeat(1000000) }, right: { code: 'y'.repeat(1000000) } },
      winner: 'left'
    };
    const hash = hashBattle(largeBattle);
    expect(hash).toMatch(/^sha256:/);
    expect(hash.length).toBe(7 + 64); // "sha256:" + 64 hex chars
  });

  test('extra fields do not affect hash (only specified fields used)', () => {
    const hash1 = hashBattle(sampleBattle);
    const hash2 = hashBattle({ ...sampleBattle, timestamp: '2026-01-01', id: 'battle-123', extra: 'data' });
    expect(hash1).toBe(hash2);
  });
});
