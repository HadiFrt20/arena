import { resolveAlias } from '../utils/config.js';
import { getAllChallenges, getChallenge } from '../challenges/index.js';
import { createProvider } from '../models/factory.js';

export function resolveAndCreateProvider(alias) {
  const resolved = resolveAlias(alias);
  const provider = createProvider(resolved);
  return provider;
}

export function resolveChallenges(challengeList) {
  if (!challengeList || challengeList === 'all') {
    return getAllChallenges('builtin');
  }
  const ids = challengeList.split(',').map(s => s.trim());
  return ids.map(id => {
    const c = getChallenge(id);
    if (!c) {
      console.error(`Challenge not found: ${id}`);
      process.exit(1);
    }
    return c;
  });
}

export const NOOP = () => {};
