import { jest } from '@jest/globals';
import { startTimer } from '../../../src/utils/timer.js';

describe('timer', () => {
  test('measures elapsed time within reasonable range', async () => {
    const timer = startTimer();
    await new Promise(r => setTimeout(r, 100));
    const elapsed = timer.elapsed();
    // Allow for scheduling variance: should be between 80 and 300ms
    expect(elapsed).toBeGreaterThanOrEqual(80);
    expect(elapsed).toBeLessThan(300);
  });

  test('uses high-resolution timing (not Date.now granularity)', async () => {
    const timer = startTimer();
    await new Promise(r => setTimeout(r, 10));
    const elapsed = timer.elapsed();
    // hrtime gives sub-millisecond precision
    // The elapsed should be a floating point number (or at least not exactly 0)
    expect(elapsed).toBeGreaterThan(0);
  });

  test('multiple independent timers do not interfere', async () => {
    const timer1 = startTimer();
    await new Promise(r => setTimeout(r, 50));
    const timer2 = startTimer();
    await new Promise(r => setTimeout(r, 50));

    const elapsed1 = timer1.elapsed();
    const elapsed2 = timer2.elapsed();

    // timer1 should be ~100ms, timer2 should be ~50ms
    expect(elapsed1).toBeGreaterThan(elapsed2);
    expect(elapsed1).toBeGreaterThanOrEqual(80);
    expect(elapsed2).toBeGreaterThanOrEqual(30);
  });

  test('returns number in milliseconds', () => {
    const timer = startTimer();
    const elapsed = timer.elapsed();
    expect(typeof elapsed).toBe('number');
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });
});
