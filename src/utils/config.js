import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { list as listProviders } from '../models/registry.js';

// Ensure every provider module has self-registered before any config lookup.
// This is a DYNAMIC import of the (top-level-await) bootstrap, not a static one:
// providers import config LAZILY (inside methods), so there is no import cycle,
// and the top-level await here guarantees the registry is fully populated before
// this module finishes evaluating — so loadConfig()/getApiKey() see all providers.
await import('../models/bootstrap.js');

const ARENA_DIR = join(homedir(), '.arena');
const CONFIG_PATH = join(ARENA_DIR, 'config.json');
const ELO_PATH = join(ARENA_DIR, 'elo.json');
const BATTLES_DIR = join(ARENA_DIR, 'battles');
const TOURNAMENTS_DIR = join(ARENA_DIR, 'tournaments');
const PACKS_DIR = join(ARENA_DIR, 'packs');
const GENERATED_DIR = join(ARENA_DIR, 'generated');

// Non-provider defaults. The `providers` section is intentionally NOT hard-coded
// here — it is DERIVED from the self-registered provider declarations in the
// registry (see deriveProviders()), so adding a provider needs no edit to this
// file. Everything else is preserved exactly as it was.
const DEFAULT_CONFIG = {
  defaults: {
    left: 'claude',
    right: 'gpt4o',
    language: 'python'
  },
  aliases: {
    'claude': 'anthropic:claude-sonnet-4-20250514',
    'claude-opus': 'anthropic:claude-opus-4-20250514',
    'gpt4o': 'openai:gpt-4o',
    'gpt5': 'openai:gpt-5',
    'gemini': 'google:gemini-2.5-pro',
    'llama3': 'ollama:llama3.3',
    'deepseek': 'ollama:deepseek-coder-v2:latest',
    'qwen': 'ollama:qwen2.5-coder:1.5b',
    'smollm': 'ollama:smollm2:135m'
  },
  global_leaderboard: {
    enabled: false,
    endpoint: 'https://arena-api.example.com',
    anonymous_id: null
  }
};

/**
 * Build the `providers` config map from the registered provider declarations.
 * Each declaration's `config` metadata becomes the per-provider config object,
 * mirroring the shape that used to be hard-coded in DEFAULT_CONFIG.providers:
 *   { api_key_env: '...' }   for key-authenticated providers, or
 *   { base_url: '...' }      for base-URL (local) providers.
 *
 * Read LAZILY (inside this function, not at module top level) so that this
 * module never depends on providers having loaded at import time — which is
 * what keeps config free of a circular import back to the providers.
 */
function deriveProviders() {
  const providers = {};
  for (const decl of listProviders()) {
    const meta = decl.config || {};
    const entry = {};
    if (meta.apiKeyEnv) entry.api_key_env = meta.apiKeyEnv;
    if (meta.baseUrlDefault) entry.base_url = meta.baseUrlDefault;
    providers[decl.name] = entry;
  }
  return providers;
}

let _dirCreated = false;

export function ensureArenaDir() {
  if (_dirCreated) return;
  mkdirSync(ARENA_DIR, { recursive: true });
  mkdirSync(BATTLES_DIR, { recursive: true });
  mkdirSync(TOURNAMENTS_DIR, { recursive: true });
  mkdirSync(PACKS_DIR, { recursive: true });
  mkdirSync(GENERATED_DIR, { recursive: true });
  _dirCreated = true;
}

let _configCache = null;

function createDefaultConfig() {
  return { ...DEFAULT_CONFIG, global_leaderboard: { ...DEFAULT_CONFIG.global_leaderboard, anonymous_id: randomUUID() } };
}

export function loadConfig() {
  if (_configCache) return _configCache;
  ensureArenaDir();

  let persisted = null;
  try {
    persisted = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    persisted = null;
  }

  // Providers are always derived from the registry, then overlaid with any
  // persisted per-provider overrides (e.g. a user-edited ollama base_url), so
  // declarations supply the defaults and disk supplies the overrides.
  const derived = deriveProviders();
  const persistedProviders = persisted?.providers || {};
  const providers = {};
  for (const name of new Set([...Object.keys(derived), ...Object.keys(persistedProviders)])) {
    providers[name] = { ...(derived[name] || {}), ...(persistedProviders[name] || {}) };
  }

  if (persisted) {
    _configCache = { ...persisted, providers };
  } else {
    _configCache = { ...createDefaultConfig(), providers };
    writeFileSync(CONFIG_PATH, JSON.stringify(_configCache, null, 2));
  }
  return _configCache;
}

export function saveConfig(config) {
  ensureArenaDir();
  _configCache = config;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function resolveAlias(alias) {
  const config = loadConfig();
  const resolved = config.aliases?.[alias] || alias;
  const [provider, ...modelParts] = resolved.split(':');
  const model = modelParts.join(':');
  if (!model) {
    throw new Error(`Invalid model specifier: "${alias}". Use format "provider:model" or a known alias.`);
  }
  return { provider, model, alias };
}

export function getApiKey(providerName) {
  const config = loadConfig();
  const providerConfig = config.providers?.[providerName];
  if (!providerConfig) throw new Error(`Unknown provider: ${providerName}`);

  if (providerConfig.api_key_env) {
    const key = process.env[providerConfig.api_key_env];
    if (!key) throw new Error(`API key not found. Set ${providerConfig.api_key_env} environment variable.`);
    return key;
  }
  return null;
}

export { ARENA_DIR, CONFIG_PATH, ELO_PATH, BATTLES_DIR, TOURNAMENTS_DIR, PACKS_DIR, GENERATED_DIR };
