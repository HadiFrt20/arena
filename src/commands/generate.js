import { loadConfig, GENERATED_DIR } from '../utils/config.js';
import { resolveAndCreateProvider } from './helpers.js';
import { generateChallenge } from '../engine/generator.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export async function generateCommand(prompt, options) {
  if (!prompt) {
    console.error('Usage: arena generate "description of the challenge" [--language python] [--difficulty medium] [--model qwen] [--run] [--output path]');
    process.exit(1);
  }

  const config = loadConfig();
  const modelAlias = options.model || config.defaults?.left || 'qwen';

  let provider;
  try {
    provider = resolveAndCreateProvider(modelAlias);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  console.log('');
  console.log(chalk.cyan('  ⚡  arena generate'));
  console.log(chalk.gray('  ─'.repeat(30)));
  console.log(`  Prompt:     ${chalk.white(prompt.slice(0, 60))}${prompt.length > 60 ? '...' : ''}`);
  console.log(`  Model:      ${chalk.bold(modelAlias)}`);
  console.log(`  Language:   ${chalk.bold(options.language || 'python')}`);
  console.log(`  Difficulty: ${chalk.bold(options.difficulty || 'medium')}`);
  console.log(chalk.gray('  ─'.repeat(30)));
  console.log('');

  process.stdout.write(chalk.yellow('  Generating challenge...'));

  let result;
  try {
    result = await generateChallenge(provider, prompt, {
      language: options.language,
      difficulty: options.difficulty,
      onToken: () => {}
    });
  } catch (err) {
    console.log('');
    console.error(chalk.red(`\n  Failed: ${err.message}`));
    process.exit(1);
  }

  const { challenge, generation_time_ms } = result;
  console.log(chalk.green(` done (${(generation_time_ms / 1000).toFixed(1)}s)`));

  // Save
  const outputPath = options.output || join(GENERATED_DIR, `${challenge.id}.json`);
  writeFileSync(outputPath, JSON.stringify(challenge, null, 2));

  console.log('');
  console.log(`  ${chalk.bold(challenge.title)} ${chalk.gray(`[${challenge.difficulty}]`)}`);
  console.log(`  ${chalk.gray('ID:')}    ${challenge.id}`);
  console.log(`  ${chalk.gray('Tests:')} ${challenge.tests.length}`);
  console.log(`  ${chalk.gray('Saved:')} ${outputPath}`);
  console.log('');

  // Show tests
  for (const t of challenge.tests) {
    console.log(`  ${chalk.gray('•')} ${t.name}`);
  }
  console.log('');

  if (options.run) {
    console.log(chalk.cyan('  Running battle with generated challenge...\n'));
    const { battleCommand } = await import('./battle.js');
    await battleCommand(outputPath, {
      left: options.left || config.defaults?.left || 'qwen',
      right: options.right || config.defaults?.right || 'smollm',
      rounds: options.rounds
    });
  }
}
