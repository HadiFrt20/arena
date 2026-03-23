import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GENERATED_DIR } from '../utils/config.js';
import { loadAllPackChallenges } from '../packs/registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _challenges = null;

function loadAll() {
  if (_challenges) return _challenges;

  _challenges = [];

  // Built-in challenges
  const builtinDir = join(__dirname, 'builtin');
  for (const file of ['algorithms.json', 'data.json', 'web.json', 'cli.json']) {
    try {
      const data = JSON.parse(readFileSync(join(builtinDir, file), 'utf-8'));
      if (Array.isArray(data)) {
        for (const c of data) { c._source = 'builtin'; _challenges.push(c); }
      }
    } catch {}
  }

  // Installed packs (via registry)
  for (const c of loadAllPackChallenges()) {
    _challenges.push(c);
  }

  // Generated challenges
  try {
    for (const file of readdirSync(GENERATED_DIR)) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(readFileSync(join(GENERATED_DIR, file), 'utf-8'));
        if (data && data.id) { data._source = 'generated'; _challenges.push(data); }
      } catch {}
    }
  } catch {}

  return _challenges;
}

export function getAllChallenges(source) {
  const all = loadAll();
  if (!source) return all;
  return all.filter(c => c._source === source || c._source?.startsWith(source));
}

export function getChallenge(id) {
  return loadAll().find(c => c.id === id) || null;
}

export function getRandomChallenge() {
  const all = loadAll();
  return all[Math.floor(Math.random() * all.length)];
}

export function getChallengesByCategory() {
  const all = loadAll();
  const grouped = {};
  for (const c of all) {
    const cat = c.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(c);
  }
  return grouped;
}

export function loadCustomChallenge(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

export function resetCache() {
  _challenges = null;
}
