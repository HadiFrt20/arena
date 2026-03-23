import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { BATTLES_DIR } from '../utils/config.js';
import { renderScoreboard } from '../ui/scoreboard-view.js';

export async function replayCommand(battleId) {
  // Try exact file first
  let filePath = join(BATTLES_DIR, `${battleId}.json`);

  if (!existsSync(filePath)) {
    // Search for partial match
    try {
      const files = readdirSync(BATTLES_DIR);
      const match = files.find(f => f.includes(battleId));
      if (match) {
        filePath = join(BATTLES_DIR, match);
      } else {
        console.error(`Battle not found: ${battleId}`);
        console.error(`Battles are stored in ${BATTLES_DIR}`);
        process.exit(1);
      }
    } catch {
      console.error(`No battles directory found. Run a battle first.`);
      process.exit(1);
    }
  }

  const battle = JSON.parse(readFileSync(filePath, 'utf-8'));
  renderScoreboard(battle);
}
