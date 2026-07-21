import { jest } from '@jest/globals';

let mockApiKey = 'test-compat-key-789';
let mockKeyThrows = false;

jest.unstable_mockModule('../../../src/utils/config.js', () => ({
  getApiKey: (name) => {
    if (name === 'openai-compatible') {
      if (mockKeyThrows) throw new Error('API key not found. Set OPENAI_COMPATIBLE_API_KEY environment variable.');
      return mockApiKey;
    }
    throw new Error(`No key for ${name}`);
  },
  loadConfig: () => ({
    providers: { 'openai-compatible': { base_url: 'http://localhost:1234/v1' } }
  }),
  ensureArenaDir: () => {},
  ELO_PATH: '/tmp/elo.json',
  ARENA_DIR: '/tmp/.arena',
  BATTLES_DIR: '/tmp/.arena/battles'
}));

const { OpenAICompatibleProvider } = await import('../../../src/models/openai-compatible.js');

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

describe('OpenAICompatibleProvider', () => {
  let originalFetch;

  beforeEach(() => { originalFetch = global.fetch; mockApiKey = 'test-compat-key-789'; mockKeyThrows = false; });
  afterEach(() => { global.fetch = originalFetch; });

  test('request POSTs to base_url/chat/completions with Authorization Bearer header and correct body', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
      'data: [DONE]\n\n'
    ]));

    const provider = new OpenAICompatibleProvider('local-model');
    for await (const _ of provider.stream('test')) {}

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:1234/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-compat-key-789',
          'Content-Type': 'application/json'
        })
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('local-model');
    expect(body.stream).toBe(true);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[0].content).toBe('test');
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

    const provider = new OpenAICompatibleProvider('local-model');
    const tokens = [];
    for await (const token of provider.stream('test')) {
      tokens.push(token);
    }

    expect(tokens).toContain('def ');
    expect(tokens).toContain('add(a, b):');
    expect(tokens).toContain('\n    return a + b');
  });

  test('stream ends on data: [DONE]', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
      'data: [DONE]\n\n',
      'data: {"choices":[{"delta":{"content":"ignored"}}]}\n\n'
    ]));

    const provider = new OpenAICompatibleProvider('local-model');
    const tokens = [];
    for await (const token of provider.stream('test')) {
      tokens.push(token);
    }
    expect(tokens).toEqual(['hello']);
  });

  test('keyless mode: no Authorization header sent but request still streams', async () => {
    mockApiKey = null;
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"choices":[{"delta":{"content":"local"}}]}\n\n',
      'data: [DONE]\n\n'
    ]));

    const provider = new OpenAICompatibleProvider('local-model');
    const tokens = [];
    for await (const token of provider.stream('test')) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['local']);
    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('keyless mode: constructor tolerates getApiKey throwing on unset env var', async () => {
    mockKeyThrows = true;
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"choices":[{"delta":{"content":"vllm"}}]}\n\n',
      'data: [DONE]\n\n'
    ]));

    const provider = new OpenAICompatibleProvider('local-model');
    expect(provider.apiKey).toBeNull();

    const tokens = [];
    for await (const token of provider.stream('test')) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['vllm']);
    expect(global.fetch.mock.calls[0][1].headers['Authorization']).toBeUndefined();
  });

  test('401 response throws error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized')
    });

    const provider = new OpenAICompatibleProvider('local-model');
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

    const provider = new OpenAICompatibleProvider('local-model');
    await expect(async () => {
      for await (const _ of provider.stream('test')) {}
    }).rejects.toThrow(/429/);
  });
});
