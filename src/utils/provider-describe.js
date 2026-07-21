/**
 * Provider-declaration describers.
 *
 * Pure functions that turn a registry provider declaration (the object passed
 * to `register()` — see src/models/registry.js) into human-readable strings.
 * Shared by the `arena providers` command and the docs-table generator so the
 * CLI and the Markdown table always describe providers identically.
 *
 * These reflect over the DECLARATION (`decl.capabilities`, `decl.config`) — the
 * only place header-auth, endpoint templates, and stream style/terminator live.
 * They deliberately do NOT read loadConfig(): config.js's deriveProviders() only
 * surfaces api_key_env / base_url and would drop everything else (e.g. Azure's
 * api-key header). Feed these declarations from registry.list()/lookup().
 */

/**
 * Auth style, e.g. "Bearer token", "header: api-key", "query param: key",
 * "none". Reads capabilities.auth plus authHeader/authParam.
 * @param {object} decl provider declaration
 * @returns {string}
 */
export function describeAuth(decl) {
  const caps = decl.capabilities || {};
  switch (caps.auth) {
    case 'bearer':
      return 'Bearer token';
    case 'header':
      return `header: ${caps.authHeader || '?'}`;
    case 'query':
      return `query param: ${caps.authParam || '?'}`;
    case 'none':
      return 'none';
    default:
      return caps.auth || 'unknown';
  }
}

/**
 * Canonical label for how a provider's stream ends, derived from
 * capabilities.stream. Three families:
 *   - '[DONE]'      -> "[DONE] sentinel"   (openai/anthropic/google/mistral/azure)
 *   - 'message-end' -> "message-end event" (cohere)
 *   - null / other  -> "stream-close"      (huggingface/ollama)
 * @param {object} stream capabilities.stream ({ style, terminator })
 * @returns {string}
 */
export function terminatorLabel(stream = {}) {
  const term = stream.terminator;
  if (term === '[DONE]') return '[DONE] sentinel';
  if (term === 'message-end') return 'message-end event';
  return 'stream-close';
}

/**
 * Stream style + termination, e.g. "sse ([DONE] sentinel)" or
 * "ndjson (stream-close)".
 * @param {object} decl provider declaration
 * @returns {string}
 */
export function describeStream(decl) {
  const stream = (decl.capabilities || {}).stream || {};
  const style = stream.style || 'unknown';
  return `${style} (${terminatorLabel(stream)})`;
}

/**
 * The endpoint (may contain {model}/{base_url}/{resource}/... placeholders),
 * straight from capabilities.endpoint.
 * @param {object} decl provider declaration
 * @returns {string}
 */
export function describeEndpoint(decl) {
  return (decl.capabilities || {}).endpoint || '';
}

/**
 * The credential source: the api-key env var for key-auth providers, or a
 * "base_url default: ..." for local/no-auth providers (ollama). Reads
 * decl.config, the same metadata deriveProviders() consumes.
 * @param {object} decl provider declaration
 * @returns {string}
 */
export function describeKeySource(decl) {
  const cfg = decl.config || {};
  if (cfg.apiKeyEnv) return cfg.apiKeyEnv;
  if (cfg.baseUrlDefault) return `base_url default: ${cfg.baseUrlDefault}`;
  return '—';
}

/**
 * One row of describers for a declaration — the shape both the CLI table and
 * the Markdown generator render.
 * @param {object} decl provider declaration
 * @returns {{name:string, auth:string, endpoint:string, stream:string, keySource:string}}
 */
export function describeProvider(decl) {
  return {
    name: decl.name,
    auth: describeAuth(decl),
    endpoint: describeEndpoint(decl),
    stream: describeStream(decl),
    keySource: describeKeySource(decl)
  };
}
