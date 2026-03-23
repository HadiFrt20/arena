import { loadConfig, saveConfig } from '../utils/config.js';
import chalk from 'chalk';

export async function configCommand() {
  const config = loadConfig();

  console.log('');
  console.log(chalk.cyan('  ╔' + '═'.repeat(52) + '╗'));
  console.log(chalk.cyan('  ║') + chalk.bold.cyan('  ⚙  Arena Configuration'));
  console.log(chalk.cyan('  ╚' + '═'.repeat(52) + '╝'));

  // Providers
  console.log(chalk.bold('\n  Providers'));
  console.log(chalk.gray.dim('  ' + '─'.repeat(50)));
  for (const [name, conf] of Object.entries(config.providers || {})) {
    if (conf.api_key_env) {
      const hasKey = !!process.env[conf.api_key_env];
      const icon = hasKey ? chalk.green('✓') : chalk.red('✗');
      const status = hasKey ? chalk.green('ready') : chalk.red('not set');
      console.log(`  ${icon}  ${chalk.white(name.padEnd(12))} ${chalk.gray(conf.api_key_env.padEnd(22))} ${status}`);
    } else if (conf.base_url) {
      console.log(`  ${chalk.blue('●')}  ${chalk.white(name.padEnd(12))} ${chalk.gray(conf.base_url)}`);
    }
  }

  // Defaults
  console.log(chalk.bold('\n  Defaults'));
  console.log(chalk.gray.dim('  ' + '─'.repeat(50)));
  console.log(`  ${chalk.gray('Left model')}   ${chalk.cyan(config.defaults?.left || 'claude')}`);
  console.log(`  ${chalk.gray('Right model')}  ${chalk.magenta(config.defaults?.right || 'gpt4o')}`);
  console.log(`  ${chalk.gray('Language')}     ${chalk.white(config.defaults?.language || 'python')}`);

  // Aliases
  console.log(chalk.bold('\n  Model Aliases'));
  console.log(chalk.gray.dim('  ' + '─'.repeat(50)));
  for (const [alias, target] of Object.entries(config.aliases || {})) {
    const [provider] = target.split(':');
    const provColor = provider === 'anthropic' ? 'blue' : provider === 'openai' ? 'green' : provider === 'google' ? 'yellow' : provider === 'ollama' ? 'magenta' : 'white';
    console.log(`  ${chalk.white.bold(alias.padEnd(14))} ${chalk.gray('→')} ${chalk[provColor](target)}`);
  }

  // Leaderboard
  console.log(chalk.bold('\n  Global Leaderboard'));
  console.log(chalk.gray.dim('  ' + '─'.repeat(50)));
  const lbEnabled = config.global_leaderboard?.enabled;
  console.log(`  ${chalk.gray('Status')}  ${lbEnabled ? chalk.green('● enabled') : chalk.gray('○ disabled')}`);

  console.log(chalk.gray.dim('\n  ' + '─'.repeat(50)));
  console.log(chalk.gray('  Edit ~/.arena/config.json to change settings.\n'));
}
