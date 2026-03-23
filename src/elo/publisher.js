import { loadConfig } from '../utils/config.js';

export async function publishBattle(battleResult) {
  const config = loadConfig();
  const { global_leaderboard } = config;

  if (!global_leaderboard?.enabled) {
    throw new Error('Global leaderboard is not enabled. Run "arena config" to enable it.');
  }

  const response = await fetch(`${global_leaderboard.endpoint}/api/battles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...battleResult,
      anonymous_id: global_leaderboard.anonymous_id
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to publish: ${err}`);
  }

  return response.json();
}

export async function fetchLeaderboard() {
  const config = loadConfig();
  const { global_leaderboard } = config;

  if (!global_leaderboard?.endpoint) {
    throw new Error('Global leaderboard endpoint not configured.');
  }

  const response = await fetch(`${global_leaderboard.endpoint}/api/leaderboard`);
  if (!response.ok) throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
  return response.json();
}
