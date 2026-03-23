#!/usr/bin/env node

import { program } from 'commander';
import { battleCommand } from '../src/commands/battle.js';
import { listCommand } from '../src/commands/challenges.js';
import { leaderboardCommand } from '../src/commands/leaderboard.js';
import { replayCommand } from '../src/commands/replay.js';
import { configCommand } from '../src/commands/config.js';
import { benchCommand } from '../src/commands/bench.js';
import { tournamentCommand } from '../src/commands/tournament.js';
import { generateCommand } from '../src/commands/generate.js';
import { installCommand } from '../src/commands/install.js';
import { publishCommand } from '../src/commands/publish.js';

program
  .name('arena')
  .description('AI coding battles in your terminal')
  .version('1.0.0');

program
  .command('battle [challenge]')
  .description('Run a battle between two AI models')
  .option('--left <model>', 'Left model alias')
  .option('--right <model>', 'Right model alias')
  .option('--language <lang>', 'Override challenge language')
  .option('--random', 'Pick a random challenge')
  .option('--rounds <n>', 'Number of rounds per battle (default 1)', parseInt)
  .action(battleCommand);

program
  .command('bench <model>')
  .description('Benchmark a model against all challenges')
  .option('--challenges <list>', 'Comma-separated challenge IDs (default: all)')
  .option('--rounds <n>', 'Rounds per challenge (default 1)', parseInt)
  .option('--json', 'Output results as JSON')
  .option('--exit-code', 'Exit with code 1 if below threshold')
  .option('--threshold <n>', 'Minimum pass rate (0-1, e.g. 0.8)', parseFloat)
  .action(benchCommand);

program
  .command('tournament')
  .description('Run a round-robin tournament between multiple models')
  .requiredOption('--models <list>', 'Comma-separated model aliases')
  .option('--challenges <list>', 'Comma-separated challenge IDs (default: all)')
  .option('--rounds <n>', 'Rounds per match (default 1)', parseInt)
  .action(tournamentCommand);

program
  .command('generate <prompt>')
  .description('Generate a challenge from a natural language description')
  .option('--language <lang>', 'Target language (default: python)')
  .option('--difficulty <level>', 'easy, medium, or hard (default: medium)')
  .option('--model <alias>', 'Model to use for generation')
  .option('--output <path>', 'Output file path')
  .option('--run', 'Immediately run a battle with the generated challenge')
  .option('--left <model>', 'Left model for --run battle')
  .option('--right <model>', 'Right model for --run battle')
  .option('--rounds <n>', 'Rounds for --run battle', parseInt)
  .action(generateCommand);

program
  .command('install [pack]')
  .description('Install a challenge pack (from registry, GitHub, or local file)')
  .option('--name <name>', 'Override pack name')
  .action(installCommand);

program
  .command('list')
  .description('List all available challenges')
  .action(listCommand);

program
  .command('leaderboard')
  .description('Show ELO rankings')
  .option('--global', 'Fetch global leaderboard')
  .action(leaderboardCommand);

program
  .command('publish [battleId]')
  .description('Publish battle results to the global leaderboard')
  .action(publishCommand);

program
  .command('replay <battleId>')
  .description('Re-render a past battle')
  .action(replayCommand);

program
  .command('config')
  .description('Configure API keys and defaults')
  .action(configCommand);

program.parse();
