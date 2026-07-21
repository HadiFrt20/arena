/**
 * Provider bootstrap.
 *
 * Scans this directory (src/models/) and imports every provider module so that
 * each self-registers into the registry on load. Runs once, at module
 * evaluation time, via a top-level await.
 *
 * Why this breaks the config <-> provider circular import:
 *   - `config.js` and `factory.js` statically import THIS module for its side
 *     effect (populating the registry).
 *   - This module imports providers DYNAMICALLY (`import()`), so providers are
 *     not part of the static import graph rooted at config.js — there is no
 *     static cycle.
 *   - Providers only touch config at runtime (in their constructors), never at
 *     module-eval time, and registration touches only the dependency-free
 *     registry. So loading a provider never re-enters config.
 *
 * Adding a new provider needs no edit here: drop a `src/models/<name>.js` that
 * calls `register(...)` and the scan picks it up automatically.
 */
// Use the `node:` specifier so the dir-scan always reads the real filesystem,
// even in test suites that mock the bare 'fs' module for unrelated reasons.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Modules in src/models/ that are NOT providers and must not be scanned.
const NON_PROVIDER_MODULES = new Set([
  'provider.js',   // BaseProvider — abstract base class
  'registry.js',   // the registry itself
  'factory.js',    // consumes the registry
  'bootstrap.js'   // this file
]);

const _thisDir = dirname(fileURLToPath(import.meta.url));

let _loaded = false;

/**
 * Import every provider module in src/models/ exactly once so they register.
 * Idempotent: subsequent calls are no-ops.
 * @returns {Promise<void>}
 */
export async function ensureProvidersLoaded() {
  if (_loaded) return;
  _loaded = true;

  const entries = readdirSync(_thisDir, { withFileTypes: true });
  const moduleFiles = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => name.endsWith('.js') && !NON_PROVIDER_MODULES.has(name))
    .sort(); // deterministic registration order

  for (const file of moduleFiles) {
    // Dynamic, relative import: resolves against this module's directory and
    // keeps providers out of the static graph (see file header).
    await import(`./${file}`);
  }
}

// Populate the registry as soon as this module is loaded. The top-level await
// guarantees the scan has completed before any importer's body runs, so
// synchronous readers (config.loadConfig, factory.createProvider) always see a
// fully-populated registry.
await ensureProvidersLoaded();
