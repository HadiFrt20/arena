import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../src/utils/config.js', () => ({
  getApiKey: (name) => {
    if (name === 'huggingface') return 'test-hf-token-xyz';
    throw new Error(`No key for ${name}`);
  },
  loadConfig: () => ({}),
  ensureArenaDir: () => {},
  ELO_PATH: '/tmp/elo.json',
  ARENA_DIR: '/tmp/.arena',
  BATTLES_DIR: '/tmp/.arena/battles'
}));

const { HuggingFaceProvider } = await import('../../../src/models/huggingface.js');

// TGI streams SSE `data: {json}` lines, each carrying a `token` object; the
// incremental text is at token.text.
function tokenEvent(text) {
  return `data: ${JSON.stringify({ token: { id: 1, text, logprob: -0.1, special: false } })}\n\n`;
}

function createSSEResponse(events) {
  const text = events.join('');
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    }
  });
  return { ok: true, status: 200, body: stream };
}

// Emit each event as its own encoded chunk, so the provider must reassemble
// text that arrives across multiple reader.read() boundaries.
function createChunkedSSEResponse(events) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event));
      controller.close();
    }
  });
  return { ok: true, status: 200, body: stream };
}

describe('HuggingFaceProvider', () => {
  let originalFetch;

  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  test('request has Authorization Bearer header, correct model URL, and stream in body', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([tokenEvent('hi')]));

    const provider = new HuggingFaceProvider('bigscience/bloom');
    for await (const _ of provider.stream('test')) {}

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api-inference.huggingface.co/models/bigscience/bloom',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-hf-token-xyz',
          'Content-Type': 'application/json'
        })
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.stream).toBe(true);
    expect(body.inputs).toBe('test');
  });

  test('extracts token.text across multiple chunks and ignores aggregated generated_text', async () => {
    global.fetch = jest.fn().mockResolvedValue(createChunkedSSEResponse([
      tokenEvent('def '),
      tokenEvent('add(a, b):'),
      tokenEvent('\n    return a + b'),
      // Final TGI event: token increment PLUS the aggregated generated_text,
      // which must NOT be emitted as its own token.
      `data: ${JSON.stringify({ token: { id: 9, text: '', special: true }, generated_text: 'def add(a, b):\n    return a + b' })}\n\n`
    ]));

    const provider = new HuggingFaceProvider('bigscience/bloom');
    const tokens = [];
    for await (const token of provider.stream('test')) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['def ', 'add(a, b):', '\n    return a + b']);
    expect(tokens.join('')).toBe('def add(a, b):\n    return a + b');
    // The aggregated generated_text was ignored — it never appears as an extra token.
    expect(tokens).not.toContain('def add(a, b):\n    return a + b');
  });

  test('terminates when the body closes with NO sentinel (not sentinel-driven)', async () => {
    // The stream contains no `[DONE]` (or any) sentinel anywhere. Termination is
    // driven purely by the response body closing. We prove genuineness with a
    // never-closing stream: if the provider waited for a sentinel it would hang
    // forever, so a timeout guard would fire. Because it terminates on body
    // close, the closing stream completes and the never-closing one is what
    // would hang — we assert the closing stream returns all tokens and ends.
    const events = [tokenEvent('hello'), tokenEvent(' world')];
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse(events));

    // Guard: assert the fixture genuinely has no [DONE] sentinel, so the test
    // can only pass by terminating on body close.
    expect(events.join('')).not.toContain('[DONE]');

    const provider = new HuggingFaceProvider('bigscience/bloom');
    const tokens = [];
    // Wrap iteration in a timeout so a sentinel-dependent (never-terminating)
    // implementation fails loudly instead of hanging the suite.
    await Promise.race([
      (async () => {
        for await (const token of provider.stream('test')) tokens.push(token);
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('stream did not terminate on body close')), 2000))
    ]);

    expect(tokens).toEqual(['hello', ' world']);
  });

  test('genuinely ends on body close: a stream that never closes never resolves', async () => {
    // A ReadableStream that enqueues tokens but NEVER calls controller.close().
    // Since HF has no sentinel, the only way to terminate is body close — so
    // iterating this stream must NOT complete. We assert the iteration promise
    // loses the race against a short timer, proving termination hinges on the
    // body closing (there is no sentinel that could end it early).
    const encoder = new TextEncoder();
    const neverClosing = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(tokenEvent('hello')));
        // deliberately never call controller.close()
      }
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, body: neverClosing });

    const provider = new HuggingFaceProvider('bigscience/bloom');
    let completed = false;
    const iterate = (async () => {
      for await (const _ of provider.stream('test')) {}
      completed = true;
    })();

    const timedOut = await Promise.race([
      iterate.then(() => false),
      new Promise((resolve) => setTimeout(() => resolve(true), 300))
    ]);

    expect(timedOut).toBe(true);
    expect(completed).toBe(false);
  });

  test('401 response throws error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized')
    });

    const provider = new HuggingFaceProvider('bigscience/bloom');
    await expect(async () => {
      for await (const _ of provider.stream('test')) {}
    }).rejects.toThrow(/401/);
  });

  test('429 response throws error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited')
    });

    const provider = new HuggingFaceProvider('bigscience/bloom');
    await expect(async () => {
      for await (const _ of provider.stream('test')) {}
    }).rejects.toThrow(/429/);
  });

  test('503 response (cold model loading) throws error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Model is currently loading')
    });

    const provider = new HuggingFaceProvider('bigscience/bloom');
    await expect(async () => {
      for await (const _ of provider.stream('test')) {}
    }).rejects.toThrow(/503/);
  });
});
