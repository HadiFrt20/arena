import { createHash } from 'crypto';

export function hashBattle(battleData) {
  const payload = JSON.stringify({
    challenge: battleData.challenge,
    models: battleData.models,
    results: battleData.results,
    winner: battleData.winner
  });
  return 'sha256:' + createHash('sha256').update(payload).digest('hex');
}
