import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { PACKS_DIR } from '../utils/config.js';

const REGISTRY_PATH = join(PACKS_DIR, 'registry.json');

function loadLocalRegistry() {
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
  } catch {
    return { installed: {} };
  }
}

function saveLocalRegistry(registry) {
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

export async function fetchRemoteRegistry() {
  const url = 'https://raw.githubusercontent.com/arena-cli/packs/main/registry.json';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch pack registry: ${response.statusText}`);
  return response.json();
}

export function getInstalledPacks() {
  return loadLocalRegistry().installed;
}

export function installPack(packName, source, challenges) {
  const packDir = join(PACKS_DIR, packName);
  mkdirSync(packDir, { recursive: true });
  writeFileSync(join(packDir, 'challenges.json'), JSON.stringify(challenges, null, 2));

  const registry = loadLocalRegistry();
  registry.installed[packName] = {
    source,
    installed_at: new Date().toISOString(),
    challenge_count: challenges.length
  };
  saveLocalRegistry(registry);
}

export function loadAllPackChallenges() {
  const all = [];
  try {
    for (const entry of readdirSync(PACKS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      try {
        const data = JSON.parse(readFileSync(join(PACKS_DIR, entry.name, 'challenges.json'), 'utf-8'));
        if (Array.isArray(data)) {
          for (const c of data) { c._source = `pack:${entry.name}`; all.push(c); }
        }
      } catch {}
    }
  } catch {}
  return all;
}
