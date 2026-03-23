import { resolveAndCreateProvider, resolveChallenges } from './helpers.js';
import { runBenchSuite } from '../engine/bench-runner.js';
import chalk from 'chalk';

export async function benchCommand(modelAlias, options) {
  if (!modelAlias) {
    console.error('Usage: arena bench <model> [--challenges list] [--rounds n] [--json] [--threshold n]');
    process.exit(1);
  }

  let provider;
  try {
    provider = resolveAndCreateProvider(modelAlias);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const challenges = resolveChallenges(options.challenges);
  const rounds = options.rounds || 1;
  const isJson = !!options.json;
  const threshold = parseFloat(options.threshold) || 0;

  if (!isJson) {
    console.log('');
    console.log(chalk.cyan('  ⚔  arena bench'));
    console.log(chalk.gray('  ─'.repeat(30)));
    console.log(`  Model:      ${chalk.bold(modelAlias)}`);
    console.log(`  Challenges: ${chalk.bold(challenges.length)}`);
    console.log(`  Rounds:     ${chalk.bold(rounds)}`);
    if (threshold > 0) console.log(`  Threshold:  ${chalk.bold((threshold * 100).toFixed(0) + '%')}`);
    console.log(chalk.gray('  ─'.repeat(30)));
    console.log('');
  }

  const result = await runBenchSuite(challenges, provider, {
    rounds,
    onStatus: isJson ? undefined : (msg) => {
      process.stdout.write(`\r  ${chalk.yellow('⠋')} ${msg}${''.padEnd(20)}`);
    },
    onChallengeComplete: isJson ? undefined : (r) => {
      const icon = r.all_passed ? chalk.green('✓') : r.tests_passed > 0 ? chalk.yellow('◐') : chalk.red('✗');
      const tests = r.all_passed
        ? chalk.green(`${r.tests_passed}/${r.tests_total}`)
        : chalk.red(`${r.tests_passed}/${r.tests_total}`);
      console.log(`\r  ${icon} ${r.challenge_id.padEnd(25)} ${tests}  ${chalk.gray(r.generation_time_ms + 'ms')}`);
    }
  });

  if (isJson) {
    const output = {
      ...result,
      threshold: threshold || undefined,
      threshold_met: threshold > 0 ? result.overall_pass_rate >= threshold : undefined
    };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  } else {
    const rateColor = result.overall_pass_rate >= 0.8 ? chalk.green : result.overall_pass_rate >= 0.5 ? chalk.yellow : chalk.red;
    console.log('');
    console.log(chalk.gray('  ─'.repeat(30)));
    console.log(`  ${chalk.bold('Results')}`);
    console.log(`  Pass rate:  ${rateColor(chalk.bold((result.overall_pass_rate * 100).toFixed(1) + '%'))}`);
    console.log(`  Tests:      ${chalk.bold(result.total_passed + '/' + result.total_tests)}`);
    console.log(`  Challenges: ${chalk.bold(result.challenges_fully_passed + '/' + result.total_challenges)} fully passed`);
    for (const [k, v] of Object.entries(result.pass_at_k)) {
      console.log(`  ${k}:     ${chalk.bold((v * 100).toFixed(0) + '%')}`);
    }
    console.log('');

    if (threshold > 0) {
      const met = result.overall_pass_rate >= threshold;
      console.log(met
        ? chalk.green(`  ✓ Threshold ${(threshold * 100).toFixed(0)}% met`)
        : chalk.red(`  ✗ Threshold ${(threshold * 100).toFixed(0)}% not met (got ${(result.overall_pass_rate * 100).toFixed(1)}%)`)
      );
      console.log('');
    }
  }

  if (options.exitCode && threshold > 0 && result.overall_pass_rate < threshold) {
    process.exit(1);
  }
}
