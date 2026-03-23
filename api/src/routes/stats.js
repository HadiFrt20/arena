export async function handleGetModelStats(modelId, env, json) {
  const rating = await env.DB.prepare(
    'SELECT * FROM ratings WHERE model = ?'
  ).bind(modelId).first();

  if (!rating) {
    return json({ error: 'Model not found' }, 404);
  }

  const recentBattles = await env.DB.prepare(`
    SELECT id, timestamp, challenge, left_model, right_model, left_score, right_score, winner
    FROM battles
    WHERE left_model = ? OR right_model = ?
    ORDER BY timestamp DESC
    LIMIT 20
  `).bind(modelId, modelId).all();

  const challengeBreakdown = await env.DB.prepare(`
    SELECT challenge,
      SUM(CASE WHEN (left_model = ? AND winner = 'left') OR (right_model = ? AND winner = 'right') THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN (left_model = ? AND winner = 'right') OR (right_model = ? AND winner = 'left') THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN winner = 'draw' THEN 1 ELSE 0 END) as draws,
      COUNT(*) as total
    FROM battles
    WHERE left_model = ? OR right_model = ?
    GROUP BY challenge
  `).bind(modelId, modelId, modelId, modelId, modelId, modelId).all();

  return json({
    model: modelId,
    elo: rating.elo,
    wins: rating.wins,
    losses: rating.losses,
    draws: rating.draws,
    total_battles: rating.total_battles,
    recent_battles: recentBattles.results,
    per_challenge: challengeBreakdown.results
  });
}
