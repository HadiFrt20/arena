export async function* readStreamLines(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) yield line;
      }
    }
    // Flush remaining buffer
    if (buffer.trim()) yield buffer;
  } finally {
    reader.releaseLock();
  }
}

export async function assertResponseOk(response, providerName) {
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${providerName} API error (${response.status}): ${err}`);
  }
}
