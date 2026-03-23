import { resolveAndCreateProvider, resolveChallenges } from './helpers.js';
import { generateMatchups, runTournament } from '../engine/tournament-runner.js';
import chalk from 'chalk';

export async function tournamentCommand(options) {
  if (!options.models) {
    console.error('Usage: arena tournament --models qwen,deepseek,smollm [--challenges fizzbuzz,lru-cache] [--rounds 3]');
    process.exit(1);
  }

  const modelAliases = options.models.split(',').map(s => s.trim());
  if (modelAliases.length < 2) {
    console.error('Need at least 2 models for a tournament.');
    process.exit(1);
  }

  const providers = {};
  for (const alias of modelAliases) {
    try {
      providers[alias] = resolveAndCreateProvider(alias);
    } catch (err) {
      console.error(`Failed to resolve model "${alias}": ${err.message}`);
      process.exit(1);
    }
  }

  const challenges = resolveChallenges(options.challenges);
  const rounds = options.rounds || 1;
  const matchups = generateMatchups(modelAliases, challenges);
  const nPairs = (modelAliases.length * (modelAliases.length - 1)) / 2;

  console.log('');
  console.log(chalk.cyan('  🏆  arena tournament'));
  console.log(chalk.gray('  ─'.repeat(30)));
  console.log(`  Models:     ${chalk.bold(modelAliases.join(', '))}`);
  console.log(`  Challenges: ${chalk.bold(challenges.length)}`);
  console.log(`  Rounds:     ${chalk.bold(rounds)}`);
  console.log(`  Matches:    ${chalk.bold(matchups.length)} (${nPairs} pairs × ${challenges.length} challenges)`);
  console.log(chalk.gray('  ─'.repeat(30)));
  console.log('');

  const result = await runTournament(matchups, providers, {
    rounds,
    onMatchStart({ index, total, left, right, challenge }) {
      process.stdout.write(`  ${chalk.gray(`[${index + 1}/${total}]`)} ${chalk.blue(left)} vs ${chalk.magenta(right)} on ${chalk.white(challenge)}...`);
    },
    onMatchComplete({ winner, scores }) {
      const w = winner === 'left' ? chalk.blue('←') : winner === 'right' ? chalk.magenta('→') : chalk.yellow('=');
      console.log(` ${w}  ${chalk.gray(`${scores.left.toFixed(1)}-${scores.right.toFixed(1)}`)}`);
    }
  });

  console.log('');
  console.log(chalk.cyan('  ─'.repeat(30)));
  console.log(chalk.bold('  Final Standings'));
  console.log(chalk.gray('  ─'.repeat(30)));
  console.log(`  ${chalk.gray('#'.padEnd(4))}${'Model'.padEnd(20)} ${'Pts'.padEnd(6)} ${'W'.padEnd(5)} ${'L'.padEnd(5)} ${'D'.padEnd(5)} ${'Avg'.padEnd(8)}`);
  console.log(chalk.gray('  ' + '─'.repeat(55)));

  for (let i = 0; i < result.standings.length; i++) {
    const s = result.standings[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    const nameColor = i === 0 ? chalk.yellow.bold : i === 1 ? chalk.white.bold : chalk.gray;
    console.log(`  ${medal}${String(i + 1).padStart(1)} ${nameColor(s.alias.padEnd(20))} ${chalk.bold(String(s.points).padEnd(6))} ${chalk.green(String(s.wins).padEnd(5))} ${chalk.red(String(s.losses).padEnd(5))} ${chalk.gray(String(s.draws).padEnd(5))} ${s.avg_score.toFixed(1)}`);
  }

  console.log('');
  console.log(chalk.gray(`  Saved: ${result.id}`));
  console.log('');
}
