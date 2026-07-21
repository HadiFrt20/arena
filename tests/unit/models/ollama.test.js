import { jest } from '@jest/globals';

// Mutable so individual tests can simulate a user's persisted ~/.arena/config
// override. Defaults to the localhost value the derived config produces.
let mockOllamaConfig = { base_url: 'http://localhost:11434' };

jest.unstable_mockModule('../../../src/utils/config.js', () => ({
  loadConfig: () => ({
    providers: { ollama: { ...mockOllamaConfig } }
  }),
  getApiKey: () => null,
  ensureArenaDir: () => {},
  ELO_PATH: '/tmp/elo.json',
  ARENA_DIR: '/tmp/.arena',
  BATTLES_DIR: '/tmp/.arena/battles'
}));

const { OllamaProvider } = await import('../../../src/models/ollama.js');

function createNDJSONResponse(objects) {
  const text = objects.map(o => JSON.stringify(o)).join('\n') + '\n';
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    }
  });
  return { ok: true, status: 200, body: stream };
}

describe('OllamaProvider', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockOllamaConfig = { base_url: 'http://localhost:11434' };
  });
  afterEach(() => {
    global.fetch = originalFetch;
    mockOllamaConfig = { base_url: 'http://localhost:11434' };
  });

  test('base_url defaults to localhost:11434', () => {
    const provider = new OllamaProvider('llama3.3');
    expect(provider.baseUrl).toBe('http://localhost:11434');
  });

  test('user-config base_url override beats the registry default', async () => {
    // Regression: a persisted ~/.arena/config.json override (e.g. a remote
    // endpoint) must win over the registry declaration's baseUrlDefault.
    mockOllamaConfig = { base_url: 'http://my-remote-ollama:9999' };

    global.fetch = jest.fn().mockResolvedValue(createNDJSONResponse([
      { response: 'hi' },
      { response: '', done: true }
    ]));

    const provider = new OllamaProvider('llama3.3');
    for await (const _ of provider.stream('test prompt')) {}

    expect(global.fetch).toHaveBeenCalledWith(
      'http://my-remote-ollama:9999/api/generate',
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('request goes to /api/generate with correct body', async () => {
    global.fetch = jest.fn().mockResolvedValue(createNDJSONResponse([
      { response: 'hello' },
      { response: '', done: true }
    ]));

    const provider = new OllamaProvider('llama3.3');
    for await (const _ of provider.stream('test prompt')) {}

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('llama3.3');
    expect(body.prompt).toBe('test prompt');
    expect(body.stream).toBe(true);
  });

  test('NDJSON parsing: extracts response field', async () => {
    global.fetch = jest.fn().mockResolvedValue(createNDJSONResponse([
      { response: 'def ' },
      { response: 'add(a, b):' },
      { response: '\n    return a + b' },
      { response: '', done: true }
    ]));

    const provider = new OllamaProvider('llama3.3');
    const tokens = [];
    for await (const token of provider.stream('test')) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['def ', 'add(a, b):', '\n    return a + b']);
  });

  test('connection refused: throws meaningful error', async () => {
    global.fetch = jest.fn().mockRejectedValue(
      new TypeError('fetch failed: ECONNREFUSED')
    );

    const provider = new OllamaProvider('llama3.3');
    await expect(async () => {
      for await (const _ of provider.stream('test')) {}
    }).rejects.toThrow(/ECONNREFUSED/);
  });

  test('model not found: API returns error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('model "nonexistent" not found')
    });

    const provider = new OllamaProvider('nonexistent');
    await expect(async () => {
      for await (const _ of provider.stream('test')) {}
    }).rejects.toThrow(/404/);
  });
});
