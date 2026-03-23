import { readFileSync, writeFileSync } from 'fs';
import { ELO_PATH, ensureArenaDir } from '../utils/config.js';
import { DEFAULT_RATING } from './calculator.js';

function loadStore() {
  ensureArenaDir();
  try {
    return JSON.parse(readFileSync(ELO_PATH, 'utf-8'));
  } catch {
    return { ratings: {}, total_battles: 0, last_updated: null };
  }
}

function saveStore(store) {
  writeFileSync(ELO_PATH, JSON.stringify(store, null, 2));
}

export function getRatings(modelIds) {
  const store = loadStore();
  return modelIds.map(id => store.ratings[id]?.elo || DEFAULT_RATING);
}

export function updateRatings(modelA, modelB, newRatingA, newRatingB, winner) {
  const store = loadStore();

  if (!store.ratings[modelA]) {
    store.ratings[modelA] = { elo: DEFAULT_RATING, wins: 0, losses: 0, draws: 0 };
  }
  if (!store.ratings[modelB]) {
    store.ratings[modelB] = { elo: DEFAULT_RATING, wins: 0, losses: 0, draws: 0 };
  }

  store.ratings[modelA].elo = newRatingA;
  store.ratings[modelB].elo = newRatingB;

  if (winner === 'left') {
    store.ratings[modelA].wins++;
    store.ratings[modelB].losses++;
  } else if (winner === 'right') {
    store.ratings[modelA].losses++;
    store.ratings[modelB].wins++;
  } else {
    store.ratings[modelA].draws++;
    store.ratings[modelB].draws++;
  }

  store.total_battles++;
  store.last_updated = new Date().toISOString();

  saveStore(store);
  return store;
}

export function getAllRatings() {
  return loadStore();
}
