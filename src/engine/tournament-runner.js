import { runBattle } from './runner.js';
import { TOURNAMENTS_DIR } from '../utils/config.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const NOOP = () => {};

export function generateMatchups(models, challenges) {
  const matchups = [];
  for (const challenge of challenges) {
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        matchups.push({ left: models[i], right: models[j], challenge });
      }
    }
  }
  return matchups;
}

export async function runTournament(matchups, providers, options = {}) {
  const { rounds = 1, onMatchStart, onMatchComplete, onProgress } = options;
  const matches = [];
  const total = matchups.length;

  for (let i = 0; i < matchups.length; i++) {
    const { left, right, challenge } = matchups[i];
    const leftProvider = providers[left];
    const rightProvider = providers[right];

    onMatchStart?.({ index: i, total, left, right, challenge: challenge.id });

    const result = await runBattle(challenge, leftProvider, rightProvider, {
      rounds,
      onLeftToken: NOOP,
      onRightToken: NOOP,
      onStatus: NOOP
    });

    const matchResult = {
      battle_id: result.id,
      left,
      right,
      challenge: challenge.id,
      winner: result.winner,
      scores: result.scores
    };

    matches.push(matchResult);
    onMatchComplete?.({ ...matchResult, index: i, total });
    onProgress?.({ completed: i + 1, total });
  }

  // Calculate standings
  const standingsMap = {};
  for (const alias of Object.keys(providers)) {
    standingsMap[alias] = { model: providers[alias].model, alias, wins: 0, losses: 0, draws: 0, points: 0, total_score: 0, matches: 0 };
  }

  for (const m of matches) {
    standingsMap[m.left].matches++;
    standingsMap[m.right].matches++;
    standingsMap[m.left].total_score += m.scores.left;
    standingsMap[m.right].total_score += m.scores.right;

    if (m.winner === 'left') {
      standingsMap[m.left].wins++;
      standingsMap[m.left].points += 3;
      standingsMap[m.right].losses++;
    } else if (m.winner === 'right') {
      standingsMap[m.right].wins++;
      standingsMap[m.right].points += 3;
      standingsMap[m.left].losses++;
    } else {
      standingsMap[m.left].draws++;
      standingsMap[m.left].points += 1;
      standingsMap[m.right].draws++;
      standingsMap[m.right].points += 1;
    }
  }

  const standings = Object.values(standingsMap)
    .map(s => ({ ...s, avg_score: s.matches > 0 ? Math.round((s.total_score / s.matches) * 10) / 10 : 0 }))
    .sort((a, b) => b.points - a.points || b.avg_score - a.avg_score);

  // Save tournament result
  const timestamp = new Date().toISOString();
  const tournamentId = `tournament-${timestamp.slice(0, 10)}-${randomBytes(4).toString('hex')}`;

  const tournamentResult = {
    id: tournamentId,
    timestamp,
    models: Object.keys(providers),
    challenges: [...new Set(matchups.map(m => m.challenge.id))],
    rounds_per_match: rounds,
    total_matches: matches.length,
    matches,
    standings
  };

  writeFileSync(join(TOURNAMENTS_DIR, `${tournamentId}.json`), JSON.stringify(tournamentResult, null, 2));

  return tournamentResult;
}
