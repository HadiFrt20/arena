import { lookup, instantiate } from './registry.js';

// Ensure providers have self-registered before any createProvider() call.
// Dynamic top-level-await import of the bootstrap (same pattern as config.js):
// providers import config lazily, so there is no import cycle, and the await
// guarantees the registry is populated before this module finishes evaluating.
await import('./bootstrap.js');

export function createProvider(resolved) {
  const { provider, model } = resolved;
  const declaration = lookup(provider);
  if (!declaration) throw new Error(`Unknown provider: ${provider}`);
  return Object.assign(instantiate(declaration, model), { alias: resolved.alias });
}
