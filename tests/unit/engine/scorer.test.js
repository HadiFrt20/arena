import { jest } from '@jest/globals';
import { calculateScore, determineWinner } from '../../../src/engine/scorer.js';

function makeResult(overrides = {}) {
  return {
    tests_passed: 8,
    tests_total: 8,
    generation_time_ms: 4000,
    lines_of_code: 40,
    qualitative: { 'thread-safe': true, 'type-hints': true, 'docstrings': true },
    ...overrides
  };
}

describe('scorer', () => {
  describe('calculateScore', () => {
    test('perfect left win: left 8/8 tests, right 5/8', () => {
      const left = makeResult({ tests_passed: 8, tests_total: 8 });
      const right = makeResult({ tests_passed: 5, tests_total: 8 });
      const leftScore = calculateScore(left, right, {});
      const rightScore = calculateScore(right, left, {});
      expect(leftScore).toBeGreaterThan(rightScore);
      // Left test component: (8/8)*60 = 60
      // Right test component: (5/8)*60 = 37.5
      const leftTestComponent = (8 / 8) * 60;
      const rightTestComponent = (5 / 8) * 60;
      expect(leftTestComponent).toBe(60);
      expect(rightTestComponent).toBe(37.5);
    });

    test('perfect right win: right 8/8 tests, left 5/8', () => {
      const left = makeResult({ tests_passed: 5, tests_total: 8 });
      const right = makeResult({ tests_passed: 8, tests_total: 8 });
      const leftScore = calculateScore(left, right, {});
      const rightScore = calculateScore(right, left, {});
      expect(rightScore).toBeGreaterThan(leftScore);
    });

    test('draw scenario: identical results produce scores within 2 points', () => {
      const left = makeResult();
      const right = makeResult();
      const leftScore = calculateScore(left, right, {});
      const rightScore = calculateScore(right, left, {});
      expect(Math.abs(leftScore - rightScore)).toBeLessThanOrEqual(2);
    });

    test('speed bonus: faster model gets 1.0, slower gets ratio', () => {
      const fast = makeResult({ generation_time_ms: 2000 });
      const slow = makeResult({ generation_time_ms: 6000 });
      const fastScore = calculateScore(fast, slow, {});
      const slowScore = calculateScore(slow, fast, {});
      // Fast: speedRatio = 1.0, speedBonus = 15
      // Slow: speedRatio = 2000/6000 = 0.333, speedBonus = 5
      expect(fastScore).toBeGreaterThan(slowScore);
      // Verify the speed component difference is ~10 (15 - 5)
      const diff = fastScore - slowScore;
      expect(diff).toBeCloseTo(10, 0);
    });

    test('brevity bonus: fewer lines gets 1.0, more gets ratio', () => {
      const short = makeResult({ lines_of_code: 30 });
      const long = makeResult({ lines_of_code: 90 });
      const shortScore = calculateScore(short, long, {});
      const longScore = calculateScore(long, short, {});
      // Short: brevityRatio = 1.0, brevityBonus = 10
      // Long: brevityRatio = 30/90 = 0.333, brevityBonus = 3.33
      expect(shortScore).toBeGreaterThan(longScore);
      const diff = shortScore - longScore;
      expect(diff).toBeCloseTo(6.67, 0);
    });

    test('qualitative checks all passing gives max bonus', () => {
      const result = makeResult({
        qualitative: { a: true, b: true, c: true }
      });
      const opponent = makeResult();
      const score = calculateScore(result, opponent, {});
      // qualBonus = (3/3) * 15 = 15
      const qualComponent = 15;
      // total = 60 + 15 + 10 + 15 = 100
      expect(score).toBe(100);
    });

    test('qualitative checks partial: 2/3 vs 1/3', () => {
      const left = makeResult({ qualitative: { a: true, b: true, c: false } });
      const right = makeResult({ qualitative: { a: true, b: false, c: false } });
      const leftScore = calculateScore(left, right, {});
      const rightScore = calculateScore(right, left, {});
      // Left qual: (2/3)*15 = 10, Right qual: (1/3)*15 = 5
      expect(leftScore).toBeGreaterThan(rightScore);
      expect(leftScore - rightScore).toBeCloseTo(5, 0);
    });

    test('zero tests passed by both: test component is 0', () => {
      const left = makeResult({ tests_passed: 0, tests_total: 8 });
      const right = makeResult({ tests_passed: 0, tests_total: 8 });
      const leftScore = calculateScore(left, right, {});
      const rightScore = calculateScore(right, left, {});
      // test component = 0, but speed + brevity + qual still count
      expect(leftScore).toBeGreaterThan(0);
      expect(rightScore).toBeGreaterThan(0);
      // Both should be equal since everything else is same
      expect(leftScore).toBe(rightScore);
      // Score should be 0 + 15 + 10 + 15 = 40
      expect(leftScore).toBe(40);
    });

    test('one model produces no output (empty code)', () => {
      const empty = makeResult({
        tests_passed: 0,
        tests_total: 8,
        generation_time_ms: 100,
        lines_of_code: 0,
        qualitative: {}
      });
      const normal = makeResult();
      const emptyScore = calculateScore(empty, normal, {});
      // tests: 0, speed: could be 1.0 (faster), brevity: 1.0 (less lines, defaults to 1),
      // qual: 0/1 * 15 = 0 (empty object -> qualChecks = [], length 0, qualTotal defaults to 1)
      expect(emptyScore).toBeLessThan(50);
    });

    test('zero generation time does not divide by zero', () => {
      const zeroTime = makeResult({ generation_time_ms: 0 });
      const normal = makeResult({ generation_time_ms: 4000 });
      // Should not throw
      expect(() => calculateScore(zeroTime, normal, {})).not.toThrow();
      expect(() => calculateScore(normal, zeroTime, {})).not.toThrow();
      const score = calculateScore(zeroTime, normal, {});
      expect(typeof score).toBe('number');
      expect(Number.isFinite(score)).toBe(true);
    });

    test('single test challenge: percentage is 0 or 100', () => {
      const pass = makeResult({ tests_passed: 1, tests_total: 1 });
      const fail = makeResult({ tests_passed: 0, tests_total: 1 });
      const opponent = makeResult();
      const passScore = calculateScore(pass, opponent, {});
      const failScore = calculateScore(fail, opponent, {});
      // pass test component = (1/1)*60 = 60
      // fail test component = (0/1)*60 = 0
      expect(passScore - failScore).toBeCloseTo(60, 0);
    });

    test('composite score math: manual calculation', () => {
      const left = {
        tests_passed: 6,
        tests_total: 8,
        generation_time_ms: 3000,
        lines_of_code: 50,
        qualitative: { a: true, b: false }
      };
      const right = {
        tests_passed: 4,
        tests_total: 8,
        generation_time_ms: 5000,
        lines_of_code: 40,
        qualitative: { a: true, b: true }
      };

      const score = calculateScore(left, right, {});

      // testScore = (6/8)*60 = 45
      const testScore = (6 / 8) * 60;
      // speedBonus: left 3000 <= right 5000, ratio = 1.0, bonus = 15
      const speedBonus = 1.0 * 15;
      // brevityBonus: left 50 > right 40, ratio = 40/50 = 0.8, bonus = 8
      const brevityBonus = (40 / 50) * 10;
      // qualBonus: 1/2 passed, bonus = (1/2)*15 = 7.5
      const qualBonus = (1 / 2) * 15;

      const expected = Math.round((testScore + speedBonus + brevityBonus + qualBonus) * 100) / 100;
      expect(score).toBe(expected);
      expect(score).toBe(75.5);
    });

    test('no qualitative checks: qualitative defaults to 0/1 giving 0', () => {
      const result = makeResult({ qualitative: {} });
      const opponent = makeResult();
      const score = calculateScore(result, opponent, {});
      // qualChecks = [], length 0, qualTotal = 1, qualPassed = 0, qualBonus = 0
      expect(score).toBe(60 + 15 + 10 + 0);
    });
  });

  describe('determineWinner', () => {
    test('left wins when left score higher by >2', () => {
      expect(determineWinner(80, 70)).toBe('left');
    });

    test('right wins when right score higher by >2', () => {
      expect(determineWinner(70, 80)).toBe('right');
    });

    test('draw when scores differ by exactly 2', () => {
      expect(determineWinner(50, 52)).toBe('draw');
    });

    test('draw when scores are equal', () => {
      expect(determineWinner(50, 50)).toBe('draw');
    });

    test('draw when scores differ by 1.5', () => {
      expect(determineWinner(50, 51.5)).toBe('draw');
    });

    test('not draw when scores differ by 2.1', () => {
      expect(determineWinner(52.1, 50)).toBe('left');
      expect(determineWinner(50, 52.1)).toBe('right');
    });
  });
});
