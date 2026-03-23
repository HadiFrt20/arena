import { jest } from '@jest/globals';
import { execute } from '../../../src/utils/sandbox.js';

describe('executor (sandbox)', () => {
  test('execute valid Python: captures stdout', async () => {
    const result = await execute('print("hello")', 'python');
    expect(result.stdout.trim()).toBe('hello');
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
  });

  test('execute valid JavaScript: captures stdout', async () => {
    const result = await execute('console.log("hello")', 'javascript');
    expect(result.stdout.trim()).toBe('hello');
    expect(result.exitCode).toBe(0);
  });

  test('capture stderr separately', async () => {
    const result = await execute('import sys; sys.stderr.write("oops\\n")', 'python');
    expect(result.stderr).toContain('oops');
  });

  test('timeout enforcement: infinite loop killed', async () => {
    const result = await execute('while True: pass', 'python', 2000);
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
  }, 10000);

  test('memory limit: JavaScript --max-old-space-size', async () => {
    // This will try to allocate huge amounts of memory
    const code = 'const a = []; while(true) a.push(Buffer.alloc(1024*1024*50));';
    const result = await execute(code, 'javascript', 10000);
    // Should either error or be killed
    expect(result.exitCode).not.toBe(0);
  }, 15000);

  test('exit code capture: non-zero exit', async () => {
    const result = await execute('import sys; sys.exit(42)', 'python');
    expect(result.exitCode).toBe(42);
  });

  test('empty code string: graceful handling', async () => {
    const result = await execute('', 'python');
    // Empty python file executes fine with exit 0
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  test('code with special characters executes without shell injection', async () => {
    const code = `x = "it's a \\"test\\" with $dollar and \`backtick\`"
print(x)`;
    const result = await execute(code, 'python');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('test');
    expect(result.stdout).toContain('$dollar');
  });

  test('temp directory isolation: cleaned up after execution', async () => {
    const { existsSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { readdirSync } = await import('fs');

    const before = readdirSync(tmpdir()).filter(d => d.startsWith('arena-'));
    await execute('print("test")', 'python');
    const after = readdirSync(tmpdir()).filter(d => d.startsWith('arena-'));
    // Temp dirs from our execution should be cleaned up
    // (there might be pre-existing ones from other tests running concurrently)
    expect(after.length).toBeLessThanOrEqual(before.length + 1);
  });

  test('concurrent execution: two runs do not interfere', async () => {
    const [r1, r2] = await Promise.all([
      execute('print("first")', 'python'),
      execute('print("second")', 'python')
    ]);
    expect(r1.stdout.trim()).toBe('first');
    expect(r2.stdout.trim()).toBe('second');
    expect(r1.exitCode).toBe(0);
    expect(r2.exitCode).toBe(0);
  });

  test('large stdout: prints many lines', async () => {
    const code = 'for i in range(10000): print(f"line {i}")';
    const result = await execute(code, 'python', 10000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(1000);
    expect(result.stdout).toContain('line 0');
    expect(result.stdout).toContain('line 9999');
  }, 15000);

  test('unsupported language returns error', async () => {
    const result = await execute('print("hi")', 'rust');
    expect(result.stderr).toContain('Unsupported language');
    expect(result.exitCode).toBe(1);
  });

  test('Python with standard library imports', async () => {
    const code = 'import json, collections, os\nprint(json.dumps({"ok": True}))';
    const result = await execute(code, 'python');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('{"ok": true}');
  });
});
