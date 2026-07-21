/**
 * Provider registry.
 *
 * A pure, dependency-free module holding the set of self-registered model
 * providers. Provider modules call `register()` at load time; `config.js` and
 * `factory.js` read it back via `lookup()` / `list()`.
 *
 * Keeping this module free of imports is what breaks the config <-> provider
 * circular import: providers can `register()` without touching config, and
 * config can read declarations without importing any provider.
 *
 * ---------------------------------------------------------------------------
 * Provider declaration shape (the contract downstream nodes reflect over):
 *
 *   {
 *     name: 'openai',                 // unique provider key (matches the
 *                                     //   `provider:model` prefix in aliases)
 *     Provider: OpenAIProvider,       // the Provider class, OR:
 *     create: (model) => provider,    //   a factory returning an instance
 *
 *     // Config metadata — EXACTLY ONE of these:
 *     config: {
 *       apiKeyEnv: 'OPENAI_API_KEY',      // key auth: env var holding the key
 *       // baseUrlDefault: 'http://...',  // local/self-hosted: default base URL
 *     },
 *
 *     // Capability metadata — reflected over by `arena providers` and the
 *     // generated docs table. All fields are descriptive, not behavioural.
 *     capabilities: {
 *       auth: 'bearer',   // how the key is presented:
 *                         //   'bearer'  -> Authorization: Bearer <key>
 *                         //   'header'  -> a custom header (see authHeader)
 *                         //   'query'   -> appended as a query-string param
 *                         //   'none'    -> no auth (local models)
 *       authHeader: 'x-api-key',        // header name when auth === 'header'
 *       endpoint: 'https://.../chat',   // request URL (template for query/path auth)
 *       stream: {
 *         style: 'sse',       // wire framing: 'sse' (data: lines) | 'ndjson'
 *         terminator: '[DONE]' // sentinel that ends an SSE stream, or null
 *       }
 *     }
 *   }
 * ---------------------------------------------------------------------------
 */

const _registry = new Map();

/**
 * Register (or replace) a provider declaration. Idempotent by `name` so that
 * a module re-imported under jest's module isolation simply overwrites its
 * prior entry instead of erroring.
 *
 * @param {object} declaration - see the shape documented above.
 * @returns {object} the stored declaration.
 */
export function register(declaration) {
  if (!declaration || typeof declaration !== 'object') {
    throw new Error('register() requires a declaration object');
  }
  const { name } = declaration;
  if (!name || typeof name !== 'string') {
    throw new Error('Provider declaration must have a string "name"');
  }
  if (!declaration.Provider && typeof declaration.create !== 'function') {
    throw new Error(`Provider "${name}" must supply a Provider class or a create() factory`);
  }
  _registry.set(name, declaration);
  return declaration;
}

/**
 * Look up a provider declaration by name.
 * @param {string} name
 * @returns {object|undefined}
 */
export function lookup(name) {
  return _registry.get(name);
}

/**
 * True if a provider with this name is registered.
 * @param {string} name
 * @returns {boolean}
 */
export function has(name) {
  return _registry.has(name);
}

/**
 * All registered declarations, in registration order.
 * @returns {object[]}
 */
export function list() {
  return [..._registry.values()];
}

/**
 * Instantiate the provider for a declaration, using its `create` factory if
 * present, otherwise `new Provider(model)`.
 * @param {object} declaration
 * @param {string} model
 * @returns {object} a provider instance.
 */
export function instantiate(declaration, model) {
  if (typeof declaration.create === 'function') {
    return declaration.create(model);
  }
  return new declaration.Provider(model);
}
