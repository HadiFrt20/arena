import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../src/utils/config.js', () => ({
  getApiKey: (name) => {
    if (name === 'cohere') return 'test-cohere-key-abc';
    throw new Error(`No key for ${name}`);
  },
  loadConfig: () => ({}),
  ensureArenaDir: () => {},
  ELO_PATH: '/tmp/elo.json',
  ARENA_DIR: '/tmp/.arena',
  BATTLES_DIR: '/tmp/.arena/battles'
}));

const { CohereProvider } = await import('../../../src/models/cohere.js');

// Cohere v2 /chat events: SSE-style `data: {json}` lines with a discriminating
// `type` field. `content-delta` carries token text at delta.message.content.text.
function contentDelta(text) {
  return `data: ${JSON.stringify({ type: 'content-delta', delta: { message: { content: { text } } } })}\n\n`;
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

describe('CohereProvider', () => {
  let originalFetch;

  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  test('request has Authorization Bearer header, correct URL, and model/stream in body', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      contentDelta('hi'),
      'data: {"type":"message-end"}\n\n'
    ]));

    const provider = new CohereProvider('command-r-plus');
    for await (const _ of provider.stream('test')) {}

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.cohere.com/v2/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-cohere-key-abc',
          'Content-Type': 'application/json'
        })
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('command-r-plus');
    expect(body.stream).toBe(true);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[0].content).toBe('test');
  });

  test('extracts content-delta text at delta.message.content.text across multiple chunks', async () => {
    global.fetch = jest.fn().mockResolvedValue(createChunkedSSEResponse([
      'data: {"type":"message-start"}\n\n',
      'data: {"type":"content-start"}\n\n',
      contentDelta('def '),
      contentDelta('add(a, b):'),
      contentDelta('\n    return a + b'),
      'data: {"type":"content-end"}\n\n',
      'data: {"type":"message-end"}\n\n'
    ]));

    const provider = new CohereProvider('command-r-plus');
    const tokens = [];
    for await (const token of provider.stream('test')) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['def ', 'add(a, b):', '\n    return a + b']);
    // non-content-delta events (message-start / content-start / content-end)
    // contribute nothing
    expect(tokens.join('')).toBe('def add(a, b):\n    return a + b');
  });

  test('terminates on message-end with NO [DONE] sentinel (does not depend on a sentinel)', async () => {
    // The stream contains no `[DONE]` anywhere. Termination must be driven purely
    // by the `message-end` event: a content-delta placed AFTER message-end must
    // never be yielded, proving the provider stopped on message-end rather than
    // running to end-of-stream or waiting for a sentinel.
    const events = [
      contentDelta('hello'),
      'data: {"type":"message-end"}\n\n',
      contentDelta('AFTER-END')
    ];
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse(events));

    // Guard: assert the fixture genuinely has no [DONE] sentinel, so the test
    // can only pass by honoring message-end.
    expect(events.join('')).not.toContain('[DONE]');

    const provider = new CohereProvider('command-r-plus');
    const tokens = [];
    for await (const token of provider.stream('test')) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['hello']);
    expect(tokens).not.toContain('AFTER-END');
  });

  test('401 response throws error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized')
    });

    const provider = new CohereProvider('command-r-plus');
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

    const provider = new CohereProvider('command-r-plus');
    await expect(async () => {
      for await (const _ of provider.stream('test')) {}
    }).rejects.toThrow(/429/);
  });

  test('500 response throws error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error')
    });

    const provider = new CohereProvider('command-r-plus');
    await expect(async () => {
      for await (const _ of provider.stream('test')) {}
    }).rejects.toThrow(/500/);
  });
});
