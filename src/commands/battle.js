import { resolveAlias, loadConfig } from '../utils/config.js';
import { getChallenge, getRandomChallenge, loadCustomChallenge } from '../challenges/index.js';
import { runBattle } from '../engine/runner.js';
import { createBattleUI } from '../ui/battle-view.js';
import { renderScoreboard } from '../ui/scoreboard-view.js';
import { createProvider } from '../models/factory.js';
import { existsSync } from 'fs';

export async function battleCommand(challengeArg, options) {
  const config = loadConfig();

  // Resolve challenge
  let challenge;
  if (options.random || !challengeArg) {
    challenge = getRandomChallenge();
    console.log(`Random challenge: ${challenge.title}`);
  } else if (existsSync(challengeArg)) {
    try {
      challenge = loadCustomChallenge(challengeArg);
    } catch (err) {
      console.error(`Failed to load challenge file "${challengeArg}": ${err.message}`);
      process.exit(1);
    }
  } else {
    challenge = getChallenge(challengeArg);
    if (!challenge) {
      console.error(`Challenge not found: ${challengeArg}. Use "arena list" to see available challenges.`);
      process.exit(1);
    }
  }

  if (options.language) {
    challenge = { ...challenge, language: options.language };
  }

  // Resolve models
  const leftAlias = options.left || config.defaults?.left || 'claude';
  const rightAlias = options.right || config.defaults?.right || 'gpt4o';

  let leftResolved, rightResolved;
  try {
    leftResolved = resolveAlias(leftAlias);
    rightResolved = resolveAlias(rightAlias);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  let leftProvider, rightProvider;
  try {
    leftProvider = createProvider(leftResolved);
    rightProvider = createProvider(rightResolved);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  // Create UI
  const numRounds = options.rounds || 1;
  const ui = createBattleUI();
  ui.update({
    challenge,
    leftAlias: leftResolved.alias,
    rightAlias: rightResolved.alias,
    leftCode: '',
    rightCode: '',
    leftStreaming: true,
    rightStreaming: true,
    status: 'Starting battle...',
    round: 1,
    totalRounds: numRounds
  });

  let leftCode = '';
  let rightCode = '';
  let uiDirty = false;
  let uiTimer = null;

  function scheduleUIUpdate() {
    if (uiTimer) return;
    uiTimer = setTimeout(() => {
      uiTimer = null;
      if (uiDirty) {
        uiDirty = false;
        ui.update({ leftCode, rightCode, leftStreaming: true, rightStreaming: true });
      }
    }, 50);
  }

  try {
    const result = await runBattle(challenge, leftProvider, rightProvider, {
      rounds: numRounds,
      onLeftToken(token) {
        leftCode += token;
        uiDirty = true;
        scheduleUIUpdate();
      },
      onRightToken(token) {
        rightCode += token;
        uiDirty = true;
        scheduleUIUpdate();
      },
      onStatus(status) {
        // Parse round number from status if multi-round
        const roundMatch = status.match(/Round (\d+)\/(\d+)/);
        if (roundMatch) {
          const round = parseInt(roundMatch[1]);
          // Reset code panes on new round
          if (status.includes('Streaming')) {
            leftCode = '';
            rightCode = '';
          }
          ui.update({ status, leftStreaming: status.includes('Streaming'), rightStreaming: status.includes('Streaming'), round, leftCode, rightCode });
        } else {
          ui.update({ status, leftStreaming: false, rightStreaming: false });
        }
      }
    });

    clearTimeout(uiTimer);
    ui.unmount();
    renderScoreboard(result);
  } catch (err) {
    clearTimeout(uiTimer);
    ui.unmount();
    console.error(`Battle failed: ${err.message}`);
    process.exit(1);
  }
}
