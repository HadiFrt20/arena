import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../src/utils/config.js', () => ({
  getApiKey: (name) => {
    if (name === 'google') return 'test-google-key-789';
    throw new Error(`No key for ${name}`);
  },
  loadConfig: () => ({}),
  ensureArenaDir: () => {},
  ELO_PATH: '/tmp/elo.json',
  ARENA_DIR: '/tmp/.arena',
  BATTLES_DIR: '/tmp/.arena/battles'
}));

const { GoogleProvider } = await import('../../../src/models/google.js');

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

describe('GoogleProvider', () => {
  let originalFetch;

  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  test('request URL contains model name and API key', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"candidates":[{"content":{"parts":[{"text":"hello"}]}}]}\n\n'
    ]));

    const provider = new GoogleProvider('gemini-2.5-pro');
    for await (const _ of provider.stream('test')) {}

    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('gemini-2.5-pro');
    expect(url).toContain('key=test-google-key-789');
    expect(url).toContain('streamGenerateContent');
  });

  test('request body has correct Gemini format', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"candidates":[{"content":{"parts":[{"text":"hi"}]}}]}\n\n'
    ]));

    const provider = new GoogleProvider('gemini-2.5-pro');
    for await (const _ of provider.stream('my prompt')) {}

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.contents).toEqual([{ parts: [{ text: 'my prompt' }] }]);
  });

  test('SSE parsing: extracts text from candidates', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"candidates":[{"content":{"parts":[{"text":"def add"}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"(a, b): return a + b"}]}}]}\n\n'
    ]));

    const provider = new GoogleProvider('gemini-2.5-pro');
    const tokens = [];
    for await (const token of provider.stream('test')) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['def add', '(a, b): return a + b']);
  });

  test('API error response throws', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('API key invalid')
    });

    const provider = new GoogleProvider('gemini-2.5-pro');
    await expect(async () => {
      for await (const _ of provider.stream('test')) {}
    }).rejects.toThrow(/403/);
  });
});
