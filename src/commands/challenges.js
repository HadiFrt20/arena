import { getChallengesByCategory } from '../challenges/index.js';
import chalk from 'chalk';

const DIFFICULTY_COLORS = { easy: 'green', medium: 'yellow', hard: 'red' };
const DIFFICULTY_ICONS = { easy: '●', medium: '◆', hard: '★' };
const CATEGORY_ICONS = {
  'algorithms': '⚡',
  'data-structures': '🔗',
  'web': '🌐',
  'cli': '⌨ '
};

export function listCommand() {
  const grouped = getChallengesByCategory();
  const total = Object.values(grouped).flat().length;

  console.log('');
  console.log(chalk.cyan('  ╔' + '═'.repeat(62) + '╗'));
  console.log(chalk.cyan('  ║') + chalk.bold.cyan('  📋  Built-in Challenges') + chalk.gray(`  (${total} total)`));
  console.log(chalk.cyan('  ╚' + '═'.repeat(62) + '╝'));
  console.log('');

  for (const [category, challenges] of Object.entries(grouped)) {
    const icon = CATEGORY_ICONS[category] || '•';
    console.log(chalk.bold(`  ${icon}  ${category.toUpperCase()}`));
    console.log(chalk.gray.dim('  ' + '─'.repeat(60)));

    for (const c of challenges) {
      const diffColor = DIFFICULTY_COLORS[c.difficulty] || 'white';
      const diffIcon = DIFFICULTY_ICONS[c.difficulty] || '•';
      const diff = chalk[diffColor](`${diffIcon} ${c.difficulty}`);
      const id = chalk.white(c.id.padEnd(22));
      const title = c.title.padEnd(34);
      const lang = chalk.gray(`${c.language}`);
      console.log(`     ${id} ${title} ${diff.padEnd(18)}  ${lang}`);
    }
    console.log('');
  }

  console.log(chalk.gray.dim('  ' + '─'.repeat(60)));
  console.log(chalk.gray(`  Usage: `) + chalk.cyan('arena battle <challenge-id>') + chalk.gray(' --left <model> --right <model>'));
  console.log('');
}
