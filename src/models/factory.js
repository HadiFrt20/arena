import { lookup, instantiate } from './registry.js';
import { getApiKey } from '../utils/config.js';

// Ensure providers have self-registered before any createProvider() call.
// Dynamic top-level-await import of the bootstrap (same pattern as config.js):
// providers import config lazily, so there is no import cycle, and the await
// guarantees the registry is populated before this module finishes evaluating.
await import('./bootstrap.js');

export function createProvider(resolved) {
  const { provider, model } = resolved;
  const declaration = lookup(provider);
  if (!declaration) throw new Error(`Unknown provider: ${provider}`);

  const instance = Object.assign(instantiate(declaration, model), { alias: resolved.alias });

  // Fail fast on a missing API key, exactly as main did: on main the provider
  // constructor resolved getApiKey() and threw here, so battle.js could report a
  // clean "API key not found..." and exit before starting the battle UI. Key
  // resolution now lives in stream() (to keep providers out of config's static
  // import graph), so we re-assert it here for key-auth providers to preserve
  // that fail-fast surface. getApiKey() returns null for non-key (e.g. ollama)
  // providers, which is fine.
  if (declaration.config?.apiKeyEnv) {
    getApiKey(provider);
  }

  return instance;
}
