import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../src/utils/config.js', () => ({
  getApiKey: (name) => {
    if (name === 'mistral') return 'test-mistral-key-789';
    throw new Error(`No key for ${name}`);
  },
  loadConfig: () => ({}),
  ensureArenaDir: () => {},
  ELO_PATH: '/tmp/elo.json',
  ARENA_DIR: '/tmp/.arena',
  BATTLES_DIR: '/tmp/.arena/battles'
}));

const { MistralProvider } = await import('../../../src/models/mistral.js');

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

describe('MistralProvider', () => {
  let originalFetch;

  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  test('request has Authorization Bearer header and correct URL and model', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
      'data: [DONE]\n\n'
    ]));

    const provider = new MistralProvider('mistral-large-latest');
    for await (const _ of provider.stream('test')) {}

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.mistral.ai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-mistral-key-789',
          'Content-Type': 'application/json'
        })
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('mistral-large-latest');
    expect(body.stream).toBe(true);
    expect(body.messages[0].role).toBe('user');
  });

  test('SSE parsing: extracts content from choices delta across multiple chunks', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"def "}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"add(a, b):"}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"\\n    return a + b"}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n'
    ]));

    const provider = new MistralProvider('mistral-large-latest');
    const tokens = [];
    for await (const token of provider.stream('test')) {
      tokens.push(token);
    }

    expect(tokens).toContain('def ');
    expect(tokens).toContain('add(a, b):');
    // empty delta content is ignored (not yielded)
    expect(tokens).not.toContain('');
  });

  test('stream ends on data: [DONE]', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
      'data: [DONE]\n\n',
      'data: {"choices":[{"delta":{"content":"AFTER-DONE"}}]}\n\n'
    ]));

    const provider = new MistralProvider('mistral-large-latest');
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

    const provider = new MistralProvider('mistral-large-latest');
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

    const provider = new MistralProvider('mistral-large-latest');
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

    const provider = new MistralProvider('mistral-large-latest');
    await expect(async () => {
      for await (const _ of provider.stream('test')) {}
    }).rejects.toThrow(/500/);
  });
});
