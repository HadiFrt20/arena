import { jest } from '@jest/globals';
import { runTests, runQualitativeChecks } from '../../../src/engine/tester.js';

const simpleChallenge = {
  id: 'test-add',
  language: 'python',
  tests: [
    { name: 'basic add', setup: '', run: 'result = add(2, 3)', assert: 'result == 5' },
    { name: 'negative', setup: '', run: 'result = add(-1, -1)', assert: 'result == -2' },
    { name: 'zero', setup: '', run: 'result = add(0, 0)', assert: 'result == 0' }
  ]
};

const jsChallenge = {
  id: 'test-add-js',
  language: 'javascript',
  tests: [
    { name: 'basic add', setup: '', run: 'result = add(2, 3)', assert: 'result === 5' },
    { name: 'zero', setup: '', run: 'result = add(0, 0)', assert: 'result === 0' }
  ]
};

describe('tester', () => {
  describe('runTests', () => {
    test('all tests pass with correct Python code', async () => {
      const code = 'def add(a, b):\n    return a + b';
      const result = await runTests(simpleChallenge, code);
      expect(result.tests_passed).toBe(3);
      expect(result.tests_total).toBe(3);
      expect(result.details).toHaveLength(3);
      result.details.forEach(d => expect(d.passed).toBe(true));
    });

    test('some tests fail with buggy code', async () => {
      const code = 'def add(a, b):\n    return a - b';
      const result = await runTests(simpleChallenge, code);
      // add(0,0) returns 0 which passes, others fail
      expect(result.tests_passed).toBe(1);
      expect(result.tests_total).toBe(3);
      expect(result.details.filter(d => d.passed)).toHaveLength(1);
      expect(result.details.filter(d => !d.passed)).toHaveLength(2);
    });

    test('code with syntax error: all tests fail gracefully', async () => {
      const code = 'def add(a, b:\n    return a + b';
      const result = await runTests(simpleChallenge, code);
      expect(result.tests_passed).toBe(0);
      expect(result.tests_total).toBe(3);
      // Should not throw, just return failures
      result.details.forEach(d => {
        expect(d.passed).toBe(false);
        expect(d.error).toBeTruthy();
      });
    });

    test('code that throws runtime error: tests after error still attempted', async () => {
      // The test harness wraps each test in try/catch, so errors are per-test
      const challenge = {
        id: 'test-error',
        language: 'python',
        tests: [
          { name: 'will error', setup: '', run: 'result = 1/0', assert: 'result == 0' },
          { name: 'will pass', setup: '', run: 'result = 1 + 1', assert: 'result == 2' }
        ]
      };
      const code = '';
      const result = await runTests(challenge, code);
      expect(result.tests_total).toBe(2);
      // First test errors, second should still be attempted
      expect(result.details).toHaveLength(2);
      expect(result.details[0].passed).toBe(false);
      expect(result.details[1].passed).toBe(true);
    });

    test('test with setup code runs before test run', async () => {
      const challenge = {
        id: 'test-setup',
        language: 'python',
        tests: [
          {
            name: 'uses setup',
            setup: 'x = 42',
            run: 'result = x',
            assert: 'result == 42'
          }
        ]
      };
      const code = '';
      const result = await runTests(challenge, code);
      expect(result.tests_passed).toBe(1);
      expect(result.details[0].passed).toBe(true);
    });

    test('various assertion expressions evaluate correctly', async () => {
      const challenge = {
        id: 'test-asserts',
        language: 'python',
        tests: [
          { name: 'equality', setup: '', run: 'result = 1', assert: 'result == 1' },
          { name: 'is None', setup: '', run: 'result = None', assert: 'result is None' },
          { name: 'len check', setup: '', run: 'result = [1,2,3]', assert: 'len(result) == 3' },
          { name: 'isinstance', setup: '', run: 'result = {}', assert: 'isinstance(result, dict)' }
        ]
      };
      const code = '';
      const result = await runTests(challenge, code);
      expect(result.tests_passed).toBe(4);
    });

    test('timeout on execution marks all tests as failed', async () => {
      const challenge = {
        id: 'test-timeout',
        language: 'python',
        tests: [
          { name: 'will timeout', setup: '', run: 'result = 1', assert: 'result == 1' }
        ]
      };
      const code = 'import time\ntime.sleep(60)';
      const result = await runTests(challenge, code, 2000);
      expect(result.tests_passed).toBe(0);
      expect(result.tests_total).toBe(1);
      expect(result.details[0].error).toContain('timed out');
    }, 15000);

    test('empty test suite returns 0/0', async () => {
      const challenge = {
        id: 'test-empty',
        language: 'python',
        tests: []
      };
      const code = 'x = 1';
      const result = await runTests(challenge, code);
      expect(result.tests_passed).toBe(0);
      expect(result.tests_total).toBe(0);
    });

    test('code that produces stdout does not interfere with assertions', async () => {
      const code = 'print("hello world")\ndef add(a, b):\n    print("computing")\n    return a + b';
      const result = await runTests(simpleChallenge, code);
      // The test harness prints JSON on the last line, stdout before it shouldn't break parsing
      expect(result.tests_passed).toBe(3);
    });

    test('unicode in code output handled correctly', async () => {
      const challenge = {
        id: 'test-unicode',
        language: 'python',
        tests: [
          { name: 'unicode', setup: '', run: "result = greet('monde')", assert: "result == 'bonjour monde'" }
        ]
      };
      const code = "def greet(name):\n    return f'bonjour {name}'";
      const result = await runTests(challenge, code);
      expect(result.tests_passed).toBe(1);
    });

    test('JavaScript tests work', async () => {
      const code = 'function add(a, b) { return a + b; }';
      const result = await runTests(jsChallenge, code);
      expect(result.tests_passed).toBe(2);
      expect(result.tests_total).toBe(2);
    });
  });

  describe('runQualitativeChecks', () => {
    test('detects matching patterns', () => {
      const code = 'import threading\nlock = threading.Lock()';
      const checks = [
        { id: 'thread-safe', patterns: ['Lock\\(\\)', 'threading'] }
      ];
      const result = runQualitativeChecks(code, checks);
      expect(result['thread-safe']).toBe(true);
    });

    test('detects missing patterns', () => {
      const code = 'def foo(): pass';
      const checks = [
        { id: 'type-hints', patterns: ['def .+\\(.*:.*\\).*->'] }
      ];
      const result = runQualitativeChecks(code, checks);
      expect(result['type-hints']).toBe(false);
    });

    test('empty checks returns empty object', () => {
      const result = runQualitativeChecks('some code', []);
      expect(result).toEqual({});
    });

    test('multiple checks with mixed results', () => {
      const code = 'def foo(x: int) -> int:\n    """docstring"""\n    return x';
      const checks = [
        { id: 'type-hints', patterns: ['def .+\\(.*:.*\\).*->'] },
        { id: 'docstrings', patterns: ['"""', "'''"] },
        { id: 'thread-safe', patterns: ['Lock\\(\\)'] }
      ];
      const result = runQualitativeChecks(code, checks);
      expect(result['type-hints']).toBe(true);
      expect(result['docstrings']).toBe(true);
      expect(result['thread-safe']).toBe(false);
    });
  });
});
