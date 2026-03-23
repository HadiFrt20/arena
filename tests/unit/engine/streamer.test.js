import { jest } from '@jest/globals';
import { streamModel } from '../../../src/engine/streamer.js';

function createMockProvider(chunks, delay = 0) {
  return {
    name: 'mock',
    model: 'mock-model',
    async *stream(prompt) {
      for (const chunk of chunks) {
        if (delay > 0) await new Promise(r => setTimeout(r, delay));
        yield chunk;
      }
    }
  };
}

function createErrorProvider(chunks, errorAfter) {
  return {
    name: 'mock',
    model: 'mock-model',
    async *stream(prompt) {
      for (let i = 0; i < chunks.length; i++) {
        if (i === errorAfter) throw new Error('Stream interrupted');
        yield chunks[i];
      }
    }
  };
}

describe('streamer', () => {
  test('single stream: all chunks concatenated in order', async () => {
    const chunks = ['def ', 'add', '(a, b)', ':\n', '    return a + b'];
    const provider = createMockProvider(chunks);
    const tokens = [];
    const result = await streamModel(provider, 'test prompt', (t) => tokens.push(t));

    expect(result.code).toBe('def add(a, b):\n    return a + b');
    expect(tokens).toEqual(chunks);
    expect(typeof result.generation_time_ms).toBe('number');
  });

  test('parallel streams: independent capture without cross-contamination', async () => {
    const chunksA = ['hello ', 'world'];
    const chunksB = ['foo ', 'bar'];
    const providerA = createMockProvider(chunksA, 10);
    const providerB = createMockProvider(chunksB, 10);

    const tokensA = [];
    const tokensB = [];

    const [resultA, resultB] = await Promise.all([
      streamModel(providerA, 'prompt A', (t) => tokensA.push(t)),
      streamModel(providerB, 'prompt B', (t) => tokensB.push(t))
    ]);

    expect(resultA.code).toBe('hello world');
    expect(resultB.code).toBe('foo bar');
    expect(tokensA).toEqual(chunksA);
    expect(tokensB).toEqual(chunksB);
  });

  test('stream error mid-way: partial output preserved', async () => {
    const chunks = ['def ', 'foo', '()', ':', '\n  pass'];
    const provider = createErrorProvider(chunks, 3);
    const tokens = [];
    const result = await streamModel(provider, 'prompt', (t) => tokens.push(t));

    // Should have first 3 chunks plus error message
    expect(result.code).toContain('def ');
    expect(result.code).toContain('foo');
    expect(result.code).toContain('()');
    expect(result.code).toContain('[ERROR:');
  });

  test('empty stream: returns empty string without crash', async () => {
    const provider = createMockProvider([]);
    const tokens = [];
    const result = await streamModel(provider, 'prompt', (t) => tokens.push(t));

    expect(result.code).toBe('');
    expect(tokens).toEqual([]);
    expect(typeof result.generation_time_ms).toBe('number');
  });

  test('very fast stream: nothing dropped', async () => {
    const chunks = Array.from({ length: 100 }, (_, i) => `chunk${i} `);
    const provider = createMockProvider(chunks, 0);
    const tokens = [];
    const result = await streamModel(provider, 'prompt', (t) => tokens.push(t));

    expect(tokens).toHaveLength(100);
    expect(result.code).toBe(chunks.join(''));
  });

  test('slow stream: all tokens captured', async () => {
    const chunks = ['a', 'b', 'c'];
    const provider = createMockProvider(chunks, 100);
    const tokens = [];
    const result = await streamModel(provider, 'prompt', (t) => tokens.push(t));

    expect(result.code).toBe('abc');
    expect(tokens).toEqual(['a', 'b', 'c']);
  });

  test('timing capture: generation_time_ms is reasonable', async () => {
    const chunks = ['hello'];
    const provider = createMockProvider(chunks, 100);
    const result = await streamModel(provider, 'prompt', () => {});

    expect(result.generation_time_ms).toBeGreaterThanOrEqual(50);
    expect(result.generation_time_ms).toBeLessThan(5000);
  });

  test('error message includes provider error text', async () => {
    const provider = {
      name: 'mock',
      model: 'mock-model',
      async *stream() {
        throw new Error('API rate limited');
      }
    };
    const result = await streamModel(provider, 'prompt', () => {});
    expect(result.code).toContain('API rate limited');
  });
});
