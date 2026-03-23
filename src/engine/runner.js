import { streamModel } from './streamer.js';
import { runTests, runQualitativeChecks } from './tester.js';
import { calculateScore, determineWinner } from './scorer.js';
import { passAtK } from './stats.js';
import { buildPrompt } from './prompts.js';
import { calculateEloChange } from '../elo/calculator.js';
import { getRatings, updateRatings } from '../elo/store.js';
import { hashBattle } from '../utils/hash.js';
import { stripMarkdownFences } from '../utils/markdown.js';
import { BATTLES_DIR } from '../utils/config.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

function countLines(code) {
  return code.split('\n').filter(l => l.trim()).length;
}

async function runRound(challenge, leftProvider, rightProvider, prompt, callbacks) {
  const { onLeftToken, onRightToken } = callbacks;
  const [leftResult, rightResult] = await Promise.all([
    streamModel(leftProvider, prompt, onLeftToken || (() => {})),
    streamModel(rightProvider, prompt, onRightToken || (() => {}))
  ]);

  const leftCode = stripMarkdownFences(leftResult.code);
  const rightCode = stripMarkdownFences(rightResult.code);

  // Run tests in parallel
  const [leftTests, rightTests] = await Promise.all([
    runTests(challenge, leftCode),
    runTests(challenge, rightCode)
  ]);

  // Qualitative checks
  const leftQual = runQualitativeChecks(leftCode, challenge.qualitative_checks || []);
  const rightQual = runQualitativeChecks(rightCode, challenge.qualitative_checks || []);

  const leftFull = {
    code: leftCode,
    generation_time_ms: leftResult.generation_time_ms,
    lines_of_code: countLines(leftCode),
    tests_passed: leftTests.tests_passed,
    tests_total: leftTests.tests_total,
    test_details: leftTests.details,
    execution_time_ms: leftTests.execution_time_ms,
    qualitative: leftQual
  };

  const rightFull = {
    code: rightCode,
    generation_time_ms: rightResult.generation_time_ms,
    lines_of_code: countLines(rightCode),
    tests_passed: rightTests.tests_passed,
    tests_total: rightTests.tests_total,
    test_details: rightTests.details,
    execution_time_ms: rightTests.execution_time_ms,
    qualitative: rightQual
  };

  const leftScore = calculateScore(leftFull, rightFull, challenge);
  const rightScore = calculateScore(rightFull, leftFull, challenge);

  return { left: leftFull, right: rightFull, scores: { left: leftScore, right: rightScore } };
}

export async function runBattle(challenge, leftProvider, rightProvider, { onLeftToken, onRightToken, onStatus, rounds = 1 }) {
  const prompt = buildPrompt(challenge);
  const numRounds = Math.max(1, Math.min(rounds, 20));
  const allRounds = [];

  for (let r = 0; r < numRounds; r++) {
    if (numRounds > 1) {
      onStatus?.(`Round ${r + 1}/${numRounds}: Streaming code from both models...`);
    } else {
      onStatus?.('Streaming code from both models...');
    }

    const round = await runRound(challenge, leftProvider, rightProvider, prompt, {
      onLeftToken, onRightToken
    });
    allRounds.push(round);

    if (numRounds > 1) {
      onStatus?.(`Round ${r + 1}/${numRounds}: Tests done. L=${round.left.tests_passed}/${round.left.tests_total} R=${round.right.tests_passed}/${round.right.tests_total}`);
    }
  }

  onStatus?.('Scoring...');

  // Pick the best round per model (highest score) as the representative result
  let bestLeftIdx = 0;
  let bestRightIdx = 0;
  for (let i = 1; i < allRounds.length; i++) {
    if (allRounds[i].scores.left > allRounds[bestLeftIdx].scores.left) bestLeftIdx = i;
    if (allRounds[i].scores.right > allRounds[bestRightIdx].scores.right) bestRightIdx = i;
  }

  const bestLeft = allRounds[bestLeftIdx].left;
  const bestRight = allRounds[bestRightIdx].right;

  // Aggregate stats across rounds
  const leftScores = allRounds.map(r => r.scores.left);
  const rightScores = allRounds.map(r => r.scores.right);
  const leftTestsPassed = allRounds.map(r => r.left.tests_passed);
  const rightTestsPassed = allRounds.map(r => r.right.tests_passed);
  const testsTotal = allRounds[0].left.tests_total;

  const leftCorrectRounds = leftTestsPassed.filter(p => p === testsTotal).length;
  const rightCorrectRounds = rightTestsPassed.filter(p => p === testsTotal).length;

  const leftAvgScore = leftScores.reduce((a, b) => a + b, 0) / numRounds;
  const rightAvgScore = rightScores.reduce((a, b) => a + b, 0) / numRounds;

  // Winner determined by average score across rounds
  const winner = determineWinner(leftAvgScore, rightAvgScore);

  // ELO update
  const leftModelId = leftProvider.model;
  const rightModelId = rightProvider.model;
  const [leftRating, rightRating] = getRatings([leftModelId, rightModelId]);
  const eloChange = calculateEloChange(leftRating, rightRating, winner);
  updateRatings(leftModelId, rightModelId, eloChange.newRatingA, eloChange.newRatingB, winner);

  // Build battle result
  const timestamp = new Date().toISOString();
  const battleId = `battle-${timestamp.slice(0, 10)}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;

  // pass@k stats (k=1 always; k=5 if rounds >= 5)
  const passAtKStats = {
    left: { 'pass@1': passAtK(numRounds, leftCorrectRounds, 1) },
    right: { 'pass@1': passAtK(numRounds, rightCorrectRounds, 1) }
  };
  if (numRounds >= 5) {
    passAtKStats.left['pass@5'] = passAtK(numRounds, leftCorrectRounds, 5);
    passAtKStats.right['pass@5'] = passAtK(numRounds, rightCorrectRounds, 5);
  }

  const battleResult = {
    id: battleId,
    timestamp,
    challenge: challenge.id,
    models: {
      left: { provider: leftProvider.name, model: leftProvider.model, alias: leftProvider.alias || leftProvider.model },
      right: { provider: rightProvider.name, model: rightProvider.model, alias: rightProvider.alias || rightProvider.model }
    },
    rounds: numRounds,
    // Best round per model (representative result for display)
    results: { left: bestLeft, right: bestRight },
    // Aggregated scoring
    scores: { left: Math.round(leftAvgScore * 100) / 100, right: Math.round(rightAvgScore * 100) / 100 },
    // Per-round details
    round_details: allRounds.map(r => ({
      scores: r.scores,
      left_tests: r.left.tests_passed,
      right_tests: r.right.tests_passed
    })),
    pass_at_k: passAtKStats,
    winner,
    elo_delta: eloChange.deltaA,
    integrity_hash: null
  };

  battleResult.integrity_hash = hashBattle(battleResult);

  // Save battle
  writeFileSync(join(BATTLES_DIR, `${battleId}.json`), JSON.stringify(battleResult, null, 2));

  return battleResult;
}
