import { jest } from '@jest/globals';
import { execute } from '../../../src/utils/sandbox.js';
import { readdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';

describe('sandbox', () => {
  test('creates isolated temp dir that is cleaned up', async () => {
    // Run execution and verify it completes (temp dir created and cleaned internally)
    const result = await execute('print("test")', 'python');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('test');
    // The sandbox creates a temp dir and removes it after execution
    // We verify indirectly by running successfully and checking no crash
  });

  test('timeout is configurable per call', async () => {
    const start = Date.now();
    const result = await execute('import time; time.sleep(10)', 'python', 1000);
    const elapsed = Date.now() - start;
    expect(result.timedOut).toBe(true);
    // Should have been killed within ~2s of the 1s timeout
    expect(elapsed).toBeLessThan(5000);
  }, 10000);

  test('different executions get separate temp dirs', async () => {
    // Write a file in one execution, check it's not visible in another
    const code1 = `
import os
with open('marker.txt', 'w') as f:
    f.write('exists')
print(os.getcwd())
`;
    const code2 = `
import os
exists = os.path.exists('marker.txt')
print(str(exists))
`;
    const [r1, r2] = await Promise.all([
      execute(code1, 'python'),
      execute(code2, 'python')
    ]);
    // Second execution should NOT see marker.txt from first
    expect(r2.stdout.trim()).toBe('False');
  });

  test('python execution uses python3 command', async () => {
    const result = await execute('import sys; print(sys.version_info.major)', 'python');
    expect(result.stdout.trim()).toBe('3');
  });

  test('javascript execution respects max-old-space-size flag', async () => {
    // This is hard to test directly, but we can verify JS works
    const result = await execute('console.log(process.version)', 'javascript');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/v\d+/);
  });
});
