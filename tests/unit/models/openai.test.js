import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../src/utils/config.js', () => ({
  getApiKey: (name) => {
    if (name === 'openai') return 'test-openai-key-456';
    throw new Error(`No key for ${name}`);
  },
  loadConfig: () => ({}),
  ensureArenaDir: () => {},
  ELO_PATH: '/tmp/elo.json',
  ARENA_DIR: '/tmp/.arena',
  BATTLES_DIR: '/tmp/.arena/battles'
}));

const { OpenAIProvider } = await import('../../../src/models/openai.js');

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

describe('OpenAIProvider', () => {
  let originalFetch;

  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  test('request has Authorization Bearer header and correct model', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
      'data: [DONE]\n\n'
    ]));

    const provider = new OpenAIProvider('gpt-4o');
    for await (const _ of provider.stream('test')) {}

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-openai-key-456',
          'Content-Type': 'application/json'
        })
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-4o');
    expect(body.stream).toBe(true);
    expect(body.messages[0].role).toBe('user');
  });

  test('SSE parsing: extracts content from choices delta', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"def "}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"add(a, b):"}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"\\n    return a + b"}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n'
    ]));

    const provider = new OpenAIProvider('gpt-4o');
    const tokens = [];
    for await (const token of provider.stream('test')) {
      tokens.push(token);
    }

    expect(tokens).toContain('def ');
    expect(tokens).toContain('add(a, b):');
  });

  test('stream ends on data: [DONE]', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
      'data: [DONE]\n\n'
    ]));

    const provider = new OpenAIProvider('gpt-4o');
    const tokens = [];
    for await (const token of provider.stream('test')) {
      tokens.push(token);
    }
    expect(tokens).toEqual(['hello']);
  });

  test('401 response throws error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized')
    });

    const provider = new OpenAIProvider('gpt-4o');
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

    const provider = new OpenAIProvider('gpt-4o');
    await expect(async () => {
      for await (const _ of provider.stream('test')) {}
    }).rejects.toThrow(/429/);
  });
});
