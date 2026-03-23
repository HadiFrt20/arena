import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { BATTLES_DIR, ARENA_DIR } from '../utils/config.js';
import { publishBattle } from '../elo/publisher.js';
import chalk from 'chalk';

const PUBLISHED_PATH = join(ARENA_DIR, 'published.json');

function loadPublished() {
  try {
    return JSON.parse(readFileSync(PUBLISHED_PATH, 'utf-8'));
  } catch {
    return { published_ids: [] };
  }
}

function savePublished(data) {
  writeFileSync(PUBLISHED_PATH, JSON.stringify(data, null, 2));
}

export async function publishCommand(battleId, options) {
  const published = loadPublished();
  const publishedSet = new Set(published.published_ids);

  let battleFiles;
  if (battleId) {
    const filePath = join(BATTLES_DIR, `${battleId}.json`);
    if (existsSync(filePath)) {
      battleFiles = [{ id: battleId, path: filePath }];
    } else {
      const all = readdirSync(BATTLES_DIR).filter(f => f.includes(battleId));
      if (all.length === 0) {
        console.error(chalk.red(`  Battle not found: ${battleId}`));
        process.exit(1);
      }
      battleFiles = all.map(f => ({ id: f.replace('.json', ''), path: join(BATTLES_DIR, f) }));
    }
  } else {
    // Publish all unpublished
    const allFiles = readdirSync(BATTLES_DIR).filter(f => f.endsWith('.json'));
    battleFiles = allFiles
      .map(f => ({ id: f.replace('.json', ''), path: join(BATTLES_DIR, f) }))
      .filter(b => !publishedSet.has(b.id));

    if (battleFiles.length === 0) {
      console.log(chalk.gray('\n  All battles already published.\n'));
      return;
    }
  }

  console.log(chalk.cyan(`\n  Publishing ${battleFiles.length} battle(s)...\n`));

  let success = 0;
  let failed = 0;

  for (const { id, path } of battleFiles) {
    try {
      const battle = JSON.parse(readFileSync(path, 'utf-8'));
      await publishBattle(battle);
      publishedSet.add(id);
      success++;
      console.log(chalk.green(`  ✓ ${id}`));
    } catch (err) {
      failed++;
      console.log(chalk.red(`  ✗ ${id}: ${err.message}`));
    }
  }

  // Save published list
  published.published_ids = [...publishedSet];
  published.last_published = new Date().toISOString();
  savePublished(published);

  console.log('');
  if (success > 0) console.log(chalk.green(`  ${success} published successfully`));
  if (failed > 0) console.log(chalk.red(`  ${failed} failed`));
  console.log('');
}
