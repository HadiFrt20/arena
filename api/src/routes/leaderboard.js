export async function handleGetLeaderboard(env, json) {
  const rows = await env.DB.prepare(
    'SELECT model, elo, wins, losses, draws, total_battles FROM ratings ORDER BY elo DESC LIMIT 100'
  ).all();

  const ratings = {};
  for (const row of rows.results) {
    ratings[row.model] = {
      elo: row.elo,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      total_battles: row.total_battles
    };
  }

  const totalBattles = await env.DB.prepare('SELECT COUNT(*) as count FROM battles').first();

  return json({
    ratings,
    total_battles: totalBattles?.count || 0,
    generated_at: new Date().toISOString()
  });
}
