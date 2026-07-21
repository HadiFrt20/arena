import { jest } from '@jest/globals';

/**
 * Live-registry integration test.
 *
 * Enumerates the REAL provider registry (populated by the dir-scan bootstrap)
 * and, for every registered provider, asserts the shared streaming contract
 * against MOCKED streams — no network, no keys. Termination is driven off each
 * provider's DECLARED `capabilities.stream`, not hardcoded per name: the only
 * per-provider knowledge here is the on-the-wire JSON shape of a token (which
 * cannot be derived from capabilities), while the stream framing and the
 * end-of-stream signal come straight from the declaration.
 */

// Mock config.js so the lazy `await import('../utils/config.js')` inside every
// provider's stream() resolves without real keys. getApiKey returns a dummy for
// every provider; loadConfig supplies ollama's base_url. Same absolute module
// path as the providers resolve, so the dynamic import is intercepted.
jest.unstable_mockModule('../../src/utils/config.js', () => ({
  getApiKey: () => 'test-key',
  loadConfig: () => ({ providers: { ollama: { base_url: 'http://localhost:11434' } } }),
  ensureArenaDir: () => {},
  ELO_PATH: '/tmp/elo.json',
  ARENA_DIR: '/tmp/.arena',
  BATTLES_DIR: '/tmp/.arena/battles'
}));

// Import the bootstrap (top-level await runs the dir-scan → every provider
// self-registers) and the real registry.
const { ensureProvidersLoaded } = await import('../../src/models/bootstrap.js');
const { list: listProviders, instantiate } = await import('../../src/models/registry.js');

await ensureProvidersLoaded();

// The full expected provider set — fail if any is missing or unexpected.
const EXPECTED_PROVIDERS = [
  'anthropic', 'azure', 'cohere', 'google',
  'huggingface', 'mistral', 'ollama', 'openai'
];

// Per-provider token encoder: how ONE token of text is framed on that API's
// wire. This is the one thing not derivable from capabilities (it is the API's
// response body schema), so it is keyed by name. Everything about framing and
// termination below comes from the declaration instead.
const TOKEN_ENCODERS = {
  openai: (t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`,
  azure: (t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`,
  mistral: (t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`,
  anthropic: (t) => `data: ${JSON.stringify({ type: 'content_block_delta', delta: { text: t } })}\n\n`,
  google: (t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`,
  cohere: (t) => `data: ${JSON.stringify({ type: 'content-delta', delta: { message: { content: { text: t } } } })}\n\n`,
  huggingface: (t) => `data: ${JSON.stringify({ token: { text: t } })}\n\n`,
  ollama: (t) => `${JSON.stringify({ response: t })}\n`
};

/**
 * The end-of-stream chunk for a provider, chosen PURELY from its declared
 * capabilities.stream. Returns null for stream-close providers (no sentinel —
 * the stream ends when the HTTP body closes).
 */
function terminatorChunk(stream) {
  if (stream.terminator === '[DONE]') return 'data: [DONE]\n\n';
  if (stream.terminator === 'message-end') return `data: ${JSON.stringify({ type: 'message-end' })}\n\n`;
  return null; // stream-close (huggingface / ollama / google)
}

/** A mocked OK streaming response whose body emits `chunks` then closes. */
function streamResponse(chunks) {
  const text = chunks.join('');
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    }
  });
  return { ok: true, status: 200, body: stream };
}

/** A mocked non-OK response (assertResponseOk reads .text()). */
function errorResponse(status) {
  return { ok: false, status, text: () => Promise.resolve(`error ${status}`) };
}

async function collect(provider, prompt = 'prompt') {
  const out = [];
  for await (const token of provider.stream(prompt)) out.push(token);
  return out;
}

describe('provider registry (live) — full set', () => {
  test('exactly the expected 8 providers are registered (no missing, no extras)', () => {
    const names = listProviders().map((d) => d.name).sort();
    expect(names).toEqual([...EXPECTED_PROVIDERS].sort());
  });

  test('every declaration carries the capability metadata the contract needs', () => {
    for (const decl of listProviders()) {
      expect(typeof decl.name).toBe('string');
      expect(decl.capabilities).toBeDefined();
      expect(decl.capabilities.stream).toBeDefined();
      expect(typeof decl.capabilities.stream.style).toBe('string');
      // A token encoder must exist for each registered provider, else the
      // data-driven contract below cannot frame a token for it.
      expect(TOKEN_ENCODERS[decl.name]).toBeDefined();
    }
  });
});

describe('provider registry (live) — shared streaming contract', () => {
  let originalFetch;
  let originalAzureResource;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalAzureResource = process.env.AZURE_OPENAI_RESOURCE;
    // Azure resolves its endpoint from this env var before fetch; set it so the
    // Azure provider reaches the (mocked) fetch like every other provider.
    process.env.AZURE_OPENAI_RESOURCE = 'test-resource';
  });
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalAzureResource === undefined) delete process.env.AZURE_OPENAI_RESOURCE;
    else process.env.AZURE_OPENAI_RESOURCE = originalAzureResource;
  });

  // One data-driven case per registered provider.
  const cases = listProviders().map((decl) => [decl.name, decl]);

  test.each(cases)('%s: streams tokens from a normal streamed response', async (name, decl) => {
    const encode = TOKEN_ENCODERS[name];
    const term = terminatorChunk(decl.capabilities.stream);

    const chunks = [encode('Hello, '), encode('world!')];
    if (term) chunks.push(term);

    global.fetch = jest.fn().mockResolvedValue(streamResponse(chunks));

    const provider = instantiate(decl, 'test-model');
    const tokens = await collect(provider);

    expect(tokens).toEqual(['Hello, ', 'world!']);
    expect(tokens.join('')).toBe('Hello, world!');
  });

  test.each(cases)('%s: surfaces a non-OK HTTP response as a thrown error', async (name, decl) => {
    global.fetch = jest.fn().mockResolvedValue(errorResponse(500));

    const provider = instantiate(decl, 'test-model');
    await expect(collect(provider)).rejects.toThrow(/500/);
  });

  test.each(cases)('%s: terminates per its declared stream style', async (name, decl) => {
    const encode = TOKEN_ENCODERS[name];
    const stream = decl.capabilities.stream;
    const term = terminatorChunk(stream);

    global.fetch = jest.fn().mockResolvedValue(
      // For sentinel-terminated streams, place a token AFTER the terminator: a
      // correct provider must STOP at the sentinel and never yield it. For
      // stream-close providers there is no sentinel — correctness is that the
      // iterator completes with exactly the pre-close tokens.
      streamResponse(
        term
          ? [encode('one'), encode('two'), term, encode('MUST_NOT_APPEAR')]
          : [encode('one'), encode('two')]
      )
    );

    const provider = instantiate(decl, 'test-model');
    const tokens = await collect(provider);

    expect(tokens).toEqual(['one', 'two']);
    if (term) {
      // Proves termination was driven by the declared terminator, not by the
      // body simply running out of chunks.
      expect(tokens).not.toContain('MUST_NOT_APPEAR');
    }
  });
});
