import { getAllRatings } from '../elo/store.js';
import { fetchLeaderboard } from '../elo/publisher.js';
import { renderLeaderboard } from '../ui/leaderboard-view.js';

export async function leaderboardCommand(options) {
  if (options.global) {
    try {
      const data = await fetchLeaderboard();
      renderLeaderboard(data.ratings || {}, 'Global Leaderboard');
    } catch (err) {
      console.error(`Failed to fetch global leaderboard: ${err.message}`);
      process.exit(1);
    }
  } else {
    const store = getAllRatings();
    renderLeaderboard(store.ratings || {}, 'Local Leaderboard', store.total_battles);
  }
}
