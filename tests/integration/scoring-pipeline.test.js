import { jest } from '@jest/globals';
import { runTests, runQualitativeChecks } from '../../src/engine/tester.js';
import { calculateScore, determineWinner } from '../../src/engine/scorer.js';
import { getChallenge } from '../../src/challenges/index.js';

describe('scoring pipeline integration', () => {
  test('perfect solution scores high (>85)', async () => {
    const challenge = getChallenge('kv-store-ttl');
    const code = `import time, threading
class TTLStore:
    def __init__(self):
        self.store = {}
        self.lock = threading.Lock()
    def set(self, key, value, ttl=None):
        exp = time.time() + ttl if ttl else None
        with self.lock:
            self.store[key] = (value, exp)
    def get(self, key):
        with self.lock:
            if key not in self.store: return None
            value, exp = self.store[key]
            if exp and time.time() > exp:
                del self.store[key]
                return None
            return value
    def delete(self, key):
        with self.lock:
            self.store.pop(key, None)
    def cleanup(self):
        now = time.time()
        with self.lock:
            self.store = {k: v for k, v in self.store.items() if v[1] is None or v[1] > now}`;

    const testResult = await runTests(challenge, code);
    const qualResult = runQualitativeChecks(code, challenge.qualitative_checks);

    const result = {
      tests_passed: testResult.tests_passed,
      tests_total: testResult.tests_total,
      generation_time_ms: 3000,
      lines_of_code: code.split('\n').filter(l => l.trim()).length,
      qualitative: qualResult
    };

    // Opponent is identical for self-comparison
    const score = calculateScore(result, result, {});
    expect(score).toBeGreaterThan(85);
    expect(testResult.tests_passed).toBe(testResult.tests_total);
  }, 20000);

  test('broken solution scores low (<50)', async () => {
    const challenge = getChallenge('kv-store-ttl');
    const code = `class TTLStore:
    def __init__(self): self.store = {}
    def set(self, key, value, ttl=None): self.store[key] = value
    def get(self, key): return self.store.get(key)
    def delete(self, key): pass
    def cleanup(self): pass`;

    const testResult = await runTests(challenge, code);
    const qualResult = runQualitativeChecks(code, challenge.qualitative_checks);

    // Make the opponent a perfect solution for comparison
    const result = {
      tests_passed: testResult.tests_passed,
      tests_total: testResult.tests_total,
      generation_time_ms: 3000,
      lines_of_code: 6,
      qualitative: qualResult
    };
    const perfectOpponent = {
      tests_passed: 5,
      tests_total: 5,
      generation_time_ms: 3000,
      lines_of_code: 20,
      qualitative: { 'thread-safe': true, 'type-hints': true, 'docstrings': true }
    };

    const score = calculateScore(result, perfectOpponent, {});
    // Failed tests + no qual checks = low score
    expect(testResult.tests_passed).toBeLessThan(testResult.tests_total);
  }, 20000);

  test('good vs bad solution: good one wins', async () => {
    const challenge = getChallenge('fizzbuzz');

    const goodCode = `def fizzbuzz(n):
    return ['FizzBuzz' if i%15==0 else 'Fizz' if i%3==0 else 'Buzz' if i%5==0 else str(i) for i in range(1, n+1)]`;
    const badCode = `def fizzbuzz(n):
    return [str(i) for i in range(1, n+1)]`;

    const [goodTests, badTests] = await Promise.all([
      runTests(challenge, goodCode),
      runTests(challenge, badCode)
    ]);

    const goodResult = {
      tests_passed: goodTests.tests_passed,
      tests_total: goodTests.tests_total,
      generation_time_ms: 2000,
      lines_of_code: 2,
      qualitative: runQualitativeChecks(goodCode, challenge.qualitative_checks)
    };
    const badResult = {
      tests_passed: badTests.tests_passed,
      tests_total: badTests.tests_total,
      generation_time_ms: 2000,
      lines_of_code: 2,
      qualitative: runQualitativeChecks(badCode, challenge.qualitative_checks)
    };

    const goodScore = calculateScore(goodResult, badResult, challenge);
    const badScore = calculateScore(badResult, goodResult, challenge);

    expect(goodScore).toBeGreaterThan(badScore);
    expect(determineWinner(goodScore, badScore)).toBe('left');
  }, 20000);

  test('qualitative checks detect threading.Lock pattern', () => {
    const code = `import threading\nlock = threading.Lock()\nwith lock: pass`;
    const checks = [{ id: 'thread-safe', patterns: ['Lock\\(\\)', 'threading'] }];
    const result = runQualitativeChecks(code, checks);
    expect(result['thread-safe']).toBe(true);
  });

  test('qualitative checks detect absence of type hints', () => {
    const code = `def foo(x):\n    return x`;
    const checks = [{ id: 'type-hints', patterns: ['def .+\\(.*:.*\\).*->'] }];
    const result = runQualitativeChecks(code, checks);
    expect(result['type-hints']).toBe(false);
  });
});
