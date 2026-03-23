import { jest } from '@jest/globals';
import { createServer } from 'http';
import { streamModel } from '../../src/engine/streamer.js';

function startSSEServer(responseChunks, delay = 10) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      let i = 0;
      function sendNext() {
        if (i < responseChunks.length) {
          res.write(responseChunks[i]);
          i++;
          setTimeout(sendNext, delay);
        } else {
          res.end();
        }
      }
      sendNext();
    });
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

function createAnthropicMockProvider(port) {
  return {
    name: 'anthropic',
    model: 'claude-mock',
    alias: 'claude',
    async *stream(prompt) {
      const response = await fetch(`http://localhost:${port}`, {
        method: 'POST',
        body: JSON.stringify({ prompt })
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const event = JSON.parse(data);
            if (event.type === 'content_block_delta' && event.delta?.text) {
              yield event.delta.text;
            }
          } catch {}
        }
      }
    }
  };
}

function createOpenAIMockProvider(port) {
  return {
    name: 'openai',
    model: 'gpt-mock',
    alias: 'gpt4o',
    async *stream(prompt) {
      const response = await fetch(`http://localhost:${port}`, {
        method: 'POST',
        body: JSON.stringify({ prompt })
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const event = JSON.parse(data);
            const content = event.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {}
        }
      }
    }
  };
}

describe('provider streaming integration', () => {
  let servers = [];

  afterEach(() => {
    for (const s of servers) {
      try { s.close(); } catch {}
    }
    servers = [];
  });

  test('Anthropic SSE mock: streamer correctly parses all tokens', async () => {
    const chunks = [
      'data: {"type":"content_block_delta","delta":{"text":"def "}}\n\n',
      'data: {"type":"content_block_delta","delta":{"text":"add(a, b):"}}\n\n',
      'data: {"type":"content_block_delta","delta":{"text":"\\n    return a + b"}}\n\n',
      'data: [DONE]\n\n'
    ];
    const { server, port } = await startSSEServer(chunks);
    servers.push(server);

    const provider = createAnthropicMockProvider(port);
    const tokens = [];
    const result = await streamModel(provider, 'test prompt', (t) => tokens.push(t));

    expect(tokens).toEqual(['def ', 'add(a, b):', '\n    return a + b']);
    expect(result.code).toBe('def add(a, b):\n    return a + b');
    expect(result.generation_time_ms).toBeGreaterThan(0);
  });

  test('OpenAI SSE mock: streamer correctly parses all tokens', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"def "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"foo():"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"\\n    pass"}}]}\n\n',
      'data: [DONE]\n\n'
    ];
    const { server, port } = await startSSEServer(chunks);
    servers.push(server);

    const provider = createOpenAIMockProvider(port);
    const tokens = [];
    const result = await streamModel(provider, 'test prompt', (t) => tokens.push(t));

    expect(tokens).toEqual(['def ', 'foo():', '\n    pass']);
    expect(result.code).toBe('def foo():\n    pass');
  });

  test('mixed providers: both stream simultaneously', async () => {
    const anthropicChunks = [
      'data: {"type":"content_block_delta","delta":{"text":"left_code"}}\n\n',
      'data: [DONE]\n\n'
    ];
    const openaiChunks = [
      'data: {"choices":[{"delta":{"content":"right_code"}}]}\n\n',
      'data: [DONE]\n\n'
    ];

    const { server: s1, port: p1 } = await startSSEServer(anthropicChunks, 20);
    const { server: s2, port: p2 } = await startSSEServer(openaiChunks, 20);
    servers.push(s1, s2);

    const leftProvider = createAnthropicMockProvider(p1);
    const rightProvider = createOpenAIMockProvider(p2);

    const leftTokens = [];
    const rightTokens = [];

    const [leftResult, rightResult] = await Promise.all([
      streamModel(leftProvider, 'prompt', (t) => leftTokens.push(t)),
      streamModel(rightProvider, 'prompt', (t) => rightTokens.push(t))
    ]);

    expect(leftResult.code).toBe('left_code');
    expect(rightResult.code).toBe('right_code');
    expect(leftTokens).toEqual(['left_code']);
    expect(rightTokens).toEqual(['right_code']);
  });
});
