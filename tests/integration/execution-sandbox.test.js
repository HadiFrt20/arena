import { jest } from '@jest/globals';
import { execute } from '../../src/utils/sandbox.js';

describe('execution sandbox integration', () => {
  test('Python hello world', async () => {
    const result = await execute('print("hello")', 'python');
    expect(result.stdout.trim()).toBe('hello');
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
  });

  test('JavaScript hello world', async () => {
    const result = await execute('console.log("hello")', 'javascript');
    expect(result.stdout.trim()).toBe('hello');
    expect(result.exitCode).toBe(0);
  });

  test('Python with standard imports', async () => {
    const code = `
import json
import time
import collections
print(json.dumps({"status": "ok"}))
`;
    const result = await execute(code, 'python');
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toEqual({ status: 'ok' });
  });

  test('infinite loop killed by timeout', async () => {
    const result = await execute('while True: pass', 'python', 2000);
    expect(result.timedOut).toBe(true);
  }, 10000);

  test('syntax error captured in stderr', async () => {
    const result = await execute('def foo(', 'python');
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('SyntaxError');
  });

  test('large output: 100,000 lines', async () => {
    const code = 'for i in range(100000): print(f"line {i}")';
    const result = await execute(code, 'python', 15000);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split('\n');
    expect(lines.length).toBe(100000);
    expect(lines[0]).toBe('line 0');
    expect(lines[99999]).toBe('line 99999');
  }, 20000);

  test('exit code propagation', async () => {
    const result = await execute('import sys; sys.exit(42)', 'python');
    expect(result.exitCode).toBe(42);
  });

  test('concurrent executions isolated', async () => {
    const code1 = `
import os
with open('test_marker.txt', 'w') as f:
    f.write('hello')
print('wrote file')
`;
    const code2 = `
import os
exists = os.path.exists('test_marker.txt')
print(f'marker exists: {exists}')
`;
    const [r1, r2] = await Promise.all([
      execute(code1, 'python'),
      execute(code2, 'python')
    ]);
    expect(r1.stdout).toContain('wrote file');
    expect(r2.stdout).toContain('marker exists: False');
  });

  test('Python stderr capture', async () => {
    const result = await execute('import sys; sys.stderr.write("warning\\n"); print("ok")', 'python');
    expect(result.stdout.trim()).toBe('ok');
    expect(result.stderr).toContain('warning');
    expect(result.exitCode).toBe(0);
  });

  test('JavaScript with process.exit', async () => {
    const result = await execute('process.exit(7)', 'javascript');
    expect(result.exitCode).toBe(7);
  });
});
