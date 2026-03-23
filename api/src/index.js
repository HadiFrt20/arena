import { handleSubmitBattle } from './routes/battles.js';
import { handleGetLeaderboard } from './routes/leaderboard.js';
import { handleGetModelStats } from './routes/stats.js';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      if (path === '/api/battles' && request.method === 'POST') {
        return handleSubmitBattle(request, env, json);
      }
      if (path === '/api/leaderboard' && request.method === 'GET') {
        return handleGetLeaderboard(env, json);
      }
      if (path.startsWith('/api/models/') && request.method === 'GET') {
        const modelId = decodeURIComponent(path.split('/api/models/')[1].replace(/\/stats$/, ''));
        return handleGetModelStats(modelId, env, json);
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
};
