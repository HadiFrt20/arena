import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../src/utils/config.js', () => ({
  getApiKey: (name) => {
    if (name === 'azure') return 'test-azure-key-abc';
    throw new Error(`No key for ${name}`);
  },
  loadConfig: () => ({}),
  ensureArenaDir: () => {},
  ELO_PATH: '/tmp/elo.json',
  ARENA_DIR: '/tmp/.arena',
  BATTLES_DIR: '/tmp/.arena/battles'
}));

const { AzureOpenAIProvider } = await import('../../../src/models/azure.js');

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

describe('AzureOpenAIProvider', () => {
  let originalFetch;
  const ENV_KEYS = [
    'AZURE_OPENAI_RESOURCE',
    'AZURE_OPENAI_DEPLOYMENT',
    'AZURE_OPENAI_API_VERSION'
  ];
  let savedEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    savedEnv = {};
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
    // Baseline: a resource is set; deployment/api-version left to defaults.
    process.env.AZURE_OPENAI_RESOURCE = 'my-resource';
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_API_VERSION;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  test('sends api-key header and does NOT send Authorization/Bearer', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
      'data: [DONE]\n\n'
    ]));

    const provider = new AzureOpenAIProvider('gpt-4o');
    for await (const _ of provider.stream('test')) {}

    const headers = global.fetch.mock.calls[0][1].headers;
    // The signature Azure distinction: api-key header present...
    expect(headers['api-key']).toBe('test-azure-key-abc');
    // ...and NO Authorization / Bearer header at all.
    expect(headers['Authorization']).toBeUndefined();
    expect(headers['authorization']).toBeUndefined();
    const headerJson = JSON.stringify(headers);
    expect(headerJson).not.toMatch(/Bearer/i);
  });

  test('URL contains deployment path segment and api-version query param', async () => {
    process.env.AZURE_OPENAI_DEPLOYMENT = 'my-deployment';
    process.env.AZURE_OPENAI_API_VERSION = '2024-05-01-preview';

    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: [DONE]\n\n'
    ]));

    const provider = new AzureOpenAIProvider('gpt-4o');
    for await (const _ of provider.stream('test')) {}

    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('https://my-resource.openai.azure.com/');
    expect(url).toContain('/openai/deployments/my-deployment/chat/completions');
    expect(url).toContain('api-version=2024-05-01-preview');
  });

  test('deployment defaults to the model name when unset', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: [DONE]\n\n'
    ]));

    const provider = new AzureOpenAIProvider('gpt-4o');
    for await (const _ of provider.stream('test')) {}

    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('/openai/deployments/gpt-4o/chat/completions');
    // The declaration's default api-version is applied.
    expect(url).toContain('api-version=2024-02-15-preview');
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

    const provider = new AzureOpenAIProvider('gpt-4o');
    const tokens = [];
    for await (const token of provider.stream('test')) {
      tokens.push(token);
    }

    expect(tokens).toContain('def ');
    expect(tokens).toContain('add(a, b):');
    expect(tokens).not.toContain('');
  });

  test('stream ends on data: [DONE]', async () => {
    global.fetch = jest.fn().mockResolvedValue(createSSEResponse([
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
      'data: [DONE]\n\n',
      'data: {"choices":[{"delta":{"content":"AFTER-DONE"}}]}\n\n'
    ]));

    const provider = new AzureOpenAIProvider('gpt-4o');
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

    const provider = new AzureOpenAIProvider('gpt-4o');
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

    const provider = new AzureOpenAIProvider('gpt-4o');
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

    const provider = new AzureOpenAIProvider('gpt-4o');
    await expect(async () => {
      for await (const _ of provider.stream('test')) {}
    }).rejects.toThrow(/500/);
  });
});
