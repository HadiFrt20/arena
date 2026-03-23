import { streamModel } from './streamer.js';
import { runTests, runQualitativeChecks } from './tester.js';
import { passAtK } from './stats.js';
import { buildPrompt } from './prompts.js';
import { stripMarkdownFences } from '../utils/markdown.js';

async function runSingleAttempt(challenge, provider, prompt) {
  const result = await streamModel(provider, prompt, () => {});
  const code = stripMarkdownFences(result.code);
  const testResult = await runTests(challenge, code);
  const qualitative = runQualitativeChecks(code, challenge.qualitative_checks || []);

  return {
    code,
    generation_time_ms: result.generation_time_ms,
    tests_passed: testResult.tests_passed,
    tests_total: testResult.tests_total,
    test_details: testResult.details,
    qualitative
  };
}

export async function runBenchmark(challenge, provider, options = {}) {
  const { rounds = 1, onStatus } = options;
  const prompt = buildPrompt(challenge);
  const attempts = [];

  for (let r = 0; r < rounds; r++) {
    onStatus?.(`${challenge.id}: round ${r + 1}/${rounds}`);
    const attempt = await runSingleAttempt(challenge, provider, prompt);
    attempts.push(attempt);
  }

  const bestAttempt = attempts.reduce((best, a) => a.tests_passed > best.tests_passed ? a : best, attempts[0]);
  const correctRounds = attempts.filter(a => a.tests_passed === a.tests_total).length;

  const passK = { 'pass@1': passAtK(rounds, correctRounds, 1) };
  if (rounds >= 5) passK['pass@5'] = passAtK(rounds, correctRounds, 5);

  return {
    challenge_id: challenge.id,
    challenge_title: challenge.title,
    tests_passed: bestAttempt.tests_passed,
    tests_total: bestAttempt.tests_total,
    pass_rate: bestAttempt.tests_total > 0 ? bestAttempt.tests_passed / bestAttempt.tests_total : 0,
    all_passed: bestAttempt.tests_passed === bestAttempt.tests_total,
    generation_time_ms: Math.round(attempts.reduce((s, a) => s + a.generation_time_ms, 0) / rounds),
    rounds: attempts.map(a => ({ tests_passed: a.tests_passed, tests_total: a.tests_total })),
    correct_rounds: correctRounds,
    pass_at_k: passK,
    test_details: bestAttempt.test_details,
    qualitative: bestAttempt.qualitative
  };
}

export async function runBenchSuite(challenges, provider, options = {}) {
  const { rounds = 1, onStatus, onChallengeComplete } = options;
  const results = [];

  for (const challenge of challenges) {
    const result = await runBenchmark(challenge, provider, { rounds, onStatus });
    results.push(result);
    onChallengeComplete?.(result);
  }

  const totalTests = results.reduce((s, r) => s + r.tests_total, 0);
  const totalPassed = results.reduce((s, r) => s + r.tests_passed, 0);
  const correctChallenges = results.filter(r => r.all_passed).length;
  const totalCorrectRounds = results.reduce((s, r) => s + r.correct_rounds, 0);
  const totalRoundsCount = results.length * rounds;

  const suitePassK = { 'pass@1': passAtK(totalRoundsCount, totalCorrectRounds, 1) };
  if (rounds >= 5) suitePassK['pass@5'] = passAtK(totalRoundsCount, totalCorrectRounds, 5);

  return {
    model: provider.model,
    alias: provider.alias || provider.model,
    timestamp: new Date().toISOString(),
    total_challenges: challenges.length,
    total_tests: totalTests,
    total_passed: totalPassed,
    overall_pass_rate: totalTests > 0 ? Math.round((totalPassed / totalTests) * 1000) / 1000 : 0,
    challenges_fully_passed: correctChallenges,
    rounds_per_challenge: rounds,
    pass_at_k: suitePassK,
    per_challenge: results
  };
}
