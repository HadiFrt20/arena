import { jest } from '@jest/globals';
import { expectedScore, newRating, calculateEloChange, DEFAULT_RATING, K } from '../../../src/elo/calculator.js';

describe('ELO calculator', () => {
  test('K-factor is 32', () => {
    expect(K).toBe(32);
  });

  test('default rating is 1200', () => {
    expect(DEFAULT_RATING).toBe(1200);
  });

  test('expected score for equal ratings is 0.5', () => {
    const exp = expectedScore(1200, 1200);
    expect(exp).toBeCloseTo(0.5, 5);
  });

  test('expected score formula matches: 1/(1+10^((Rb-Ra)/400))', () => {
    const ra = 1400;
    const rb = 1200;
    const expected = 1 / (1 + Math.pow(10, (rb - ra) / 400));
    expect(expectedScore(ra, rb)).toBeCloseTo(expected, 10);
  });

  test('higher rated player has higher expected score', () => {
    const expHigh = expectedScore(1600, 1200);
    const expLow = expectedScore(1200, 1600);
    expect(expHigh).toBeGreaterThan(0.5);
    expect(expLow).toBeLessThan(0.5);
    expect(expHigh + expLow).toBeCloseTo(1.0, 5);
  });

  test('equal ratings, left wins: both move by K/2 = 16', () => {
    const result = calculateEloChange(1200, 1200, 'left');
    expect(result.newRatingA).toBe(1216);
    expect(result.newRatingB).toBe(1184);
    expect(result.deltaA).toBe(16);
    expect(result.deltaB).toBe(-16);
  });

  test('equal ratings, draw: no change', () => {
    const result = calculateEloChange(1200, 1200, 'draw');
    expect(result.newRatingA).toBe(1200);
    expect(result.newRatingB).toBe(1200);
    expect(result.deltaA).toBe(0);
    expect(result.deltaB).toBe(0);
  });

  test('higher rated wins (expected): gains fewer than K/2', () => {
    const result = calculateEloChange(1400, 1200, 'left');
    expect(result.deltaA).toBeGreaterThan(0);
    expect(result.deltaA).toBeLessThan(16);
    expect(result.deltaB).toBeLessThan(0);
    expect(result.deltaB).toBeGreaterThan(-16);
  });

  test('lower rated wins (upset): gains more than K/2', () => {
    const result = calculateEloChange(1400, 1200, 'right');
    // Right (1200) wins against Left (1400)
    expect(result.deltaB).toBeGreaterThan(16);
    expect(result.deltaA).toBeLessThan(-16);
  });

  test('extreme rating difference: 2000 vs 800, upset', () => {
    const result = calculateEloChange(2000, 800, 'right');
    // 800 beats 2000 - huge upset
    expect(result.deltaB).toBeGreaterThan(25); // Should be close to K=32
    expect(result.deltaA).toBeLessThan(-25);
    // But still bounded by K
    expect(result.deltaB).toBeLessThanOrEqual(32);
    expect(result.deltaA).toBeGreaterThanOrEqual(-32);
  });

  test('symmetry: sum of both rating changes is zero', () => {
    const testCases = [
      [1200, 1200, 'left'],
      [1200, 1200, 'right'],
      [1200, 1200, 'draw'],
      [1400, 1200, 'left'],
      [1400, 1200, 'right'],
      [2000, 800, 'left'],
      [800, 2000, 'right'],
      [1500, 1500, 'draw']
    ];
    for (const [ra, rb, winner] of testCases) {
      const result = calculateEloChange(ra, rb, winner);
      expect(result.deltaA + result.deltaB).toBe(0);
    }
  });

  test('newRating calculation is correct', () => {
    // If expected = 0.5 and actual = 1 (win): 1200 + 32*(1-0.5) = 1216
    expect(newRating(1200, 0.5, 1)).toBe(1216);
    // If expected = 0.5 and actual = 0 (loss): 1200 + 32*(0-0.5) = 1184
    expect(newRating(1200, 0.5, 0)).toBe(1184);
    // If expected = 0.5 and actual = 0.5 (draw): 1200 + 32*(0.5-0.5) = 1200
    expect(newRating(1200, 0.5, 0.5)).toBe(1200);
  });

  test('right wins: modelB gains, modelA loses', () => {
    const result = calculateEloChange(1200, 1200, 'right');
    expect(result.newRatingA).toBe(1184);
    expect(result.newRatingB).toBe(1216);
    expect(result.deltaA).toBe(-16);
    expect(result.deltaB).toBe(16);
  });
});
