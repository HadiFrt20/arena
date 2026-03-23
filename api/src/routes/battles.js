export async function handleSubmitBattle(request, env, json) {
  const body = await request.json();

  if (!body.id || !body.challenge || !body.models || !body.winner) {
    return json({ error: 'Missing required fields: id, challenge, models, winner' }, 400);
  }

  // Check for duplicate
  const existing = await env.DB.prepare('SELECT id FROM battles WHERE id = ?').bind(body.id).first();
  if (existing) {
    return json({ message: 'Battle already submitted', id: body.id }, 200);
  }

  // Insert battle
  await env.DB.prepare(`
    INSERT INTO battles (id, timestamp, challenge, left_model, right_model, left_score, right_score, winner, elo_delta, anonymous_id, integrity_hash, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.id,
    body.timestamp || new Date().toISOString(),
    body.challenge,
    body.models?.left?.model || '',
    body.models?.right?.model || '',
    body.scores?.left || 0,
    body.scores?.right || 0,
    body.winner,
    body.elo_delta || 0,
    body.anonymous_id || '',
    body.integrity_hash || '',
    JSON.stringify(body)
  ).run();

  // Update ratings for both models
  for (const side of ['left', 'right']) {
    const model = body.models?.[side]?.model;
    if (!model) continue;

    const isWinner = body.winner === side;
    const isDraw = body.winner === 'draw';

    await env.DB.prepare(`
      INSERT INTO ratings (model, elo, wins, losses, draws, total_battles, last_updated)
      VALUES (?, 1200, ?, ?, ?, 1, datetime('now'))
      ON CONFLICT(model) DO UPDATE SET
        wins = wins + ?,
        losses = losses + ?,
        draws = draws + ?,
        total_battles = total_battles + 1,
        last_updated = datetime('now')
    `).bind(
      model,
      isWinner ? 1 : 0, (!isWinner && !isDraw) ? 1 : 0, isDraw ? 1 : 0,
      isWinner ? 1 : 0, (!isWinner && !isDraw) ? 1 : 0, isDraw ? 1 : 0
    ).run();
  }

  return json({ success: true, id: body.id });
}
