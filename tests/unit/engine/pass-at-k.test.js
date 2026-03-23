import { jest } from '@jest/globals';
import { passAtK } from '../../../src/engine/stats.js';

describe('passAtK', () => {
  test('pass@1 with all correct: 100%', () => {
    expect(passAtK(10, 10, 1)).toBe(1.0);
  });

  test('pass@1 with none correct: 0%', () => {
    expect(passAtK(10, 0, 1)).toBe(0.0);
  });

  test('pass@1 with half correct: 50%', () => {
    expect(passAtK(10, 5, 1)).toBeCloseTo(0.5, 5);
  });

  test('pass@5 with 3/10 correct', () => {
    // 1 - C(7,5)/C(10,5) = 1 - 21/252 = 1 - 0.0833 = 0.9167
    expect(passAtK(10, 3, 5)).toBeCloseTo(0.9167, 3);
  });

  test('pass@5 with 1/10 correct', () => {
    // 1 - C(9,5)/C(10,5) = 1 - 126/252 = 0.5
    expect(passAtK(10, 1, 5)).toBeCloseTo(0.5, 5);
  });

  test('pass@10 with 1/10 correct: 100%', () => {
    // With k=n and c>=1, you must pick the correct one
    expect(passAtK(10, 1, 10)).toBeCloseTo(1.0, 5);
  });

  test('n < k: returns 1 if any correct, 0 otherwise', () => {
    expect(passAtK(3, 1, 5)).toBe(1.0);
    expect(passAtK(3, 0, 5)).toBe(0.0);
  });

  test('single sample pass@1', () => {
    expect(passAtK(1, 1, 1)).toBe(1.0);
    expect(passAtK(1, 0, 1)).toBe(0.0);
  });

  test('Chen et al. example: n=200, c=100, k=1', () => {
    // pass@1 = c/n = 0.5
    expect(passAtK(200, 100, 1)).toBeCloseTo(0.5, 5);
  });

  test('monotonically increasing with k', () => {
    const p1 = passAtK(20, 5, 1);
    const p5 = passAtK(20, 5, 5);
    const p10 = passAtK(20, 5, 10);
    expect(p5).toBeGreaterThan(p1);
    expect(p10).toBeGreaterThan(p5);
  });

  test('monotonically increasing with c', () => {
    const p0 = passAtK(10, 0, 5);
    const p3 = passAtK(10, 3, 5);
    const p7 = passAtK(10, 7, 5);
    const p10 = passAtK(10, 10, 5);
    expect(p0).toBe(0);
    expect(p3).toBeGreaterThan(p0);
    expect(p7).toBeGreaterThan(p3);
    expect(p10).toBe(1.0);
  });
});
