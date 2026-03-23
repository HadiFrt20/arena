import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

const ARENA_DIR = join(homedir(), '.arena');
const CONFIG_PATH = join(ARENA_DIR, 'config.json');
const ELO_PATH = join(ARENA_DIR, 'elo.json');
const BATTLES_DIR = join(ARENA_DIR, 'battles');
const TOURNAMENTS_DIR = join(ARENA_DIR, 'tournaments');
const PACKS_DIR = join(ARENA_DIR, 'packs');
const GENERATED_DIR = join(ARENA_DIR, 'generated');

const DEFAULT_CONFIG = {
  providers: {
    anthropic: { api_key_env: 'ANTHROPIC_API_KEY' },
    openai: { api_key_env: 'OPENAI_API_KEY' },
    google: { api_key_env: 'GOOGLE_API_KEY' },
    ollama: { base_url: 'http://localhost:11434' }
  },
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
  try {
    _configCache = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    _configCache = createDefaultConfig();
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
