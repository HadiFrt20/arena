import { existsSync, readFileSync } from 'fs';
import { installPack, fetchRemoteRegistry, getInstalledPacks } from '../packs/registry.js';
import { validatePack } from '../challenges/validator.js';
import chalk from 'chalk';

async function downloadPack(source) {
  // GitHub URL: https://github.com/user/repo or github:user/repo
  const ghMatch = source.match(/^(?:github:|https?:\/\/github\.com\/)([^/]+\/[^/]+)/);
  if (ghMatch) {
    const repo = ghMatch[1].replace(/\.git$/, '');
    const url = `https://raw.githubusercontent.com/${repo}/main/challenges.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch from GitHub: ${response.statusText}`);
    return { challenges: await response.json(), source: `github:${repo}` };
  }

  // URL
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    return { challenges: await response.json(), source };
  }

  // Local file
  if (existsSync(source)) {
    const content = JSON.parse(readFileSync(source, 'utf-8'));
    const challenges = Array.isArray(content) ? content : [content];
    return { challenges, source: `local:${source}` };
  }

  // Try remote registry lookup
  try {
    const registry = await fetchRemoteRegistry();
    const pack = registry.packs?.find(p => p.name === source);
    if (pack) {
      return downloadPack(pack.source);
    }
  } catch {}

  throw new Error(`Could not resolve pack: "${source}". Provide a file path, GitHub URL, or registry pack name.`);
}

export async function installCommand(packNameOrUrl, options) {
  if (!packNameOrUrl) {
    // List installed packs
    const installed = getInstalledPacks();
    const names = Object.keys(installed);
    if (names.length === 0) {
      console.log(chalk.gray('\n  No packs installed. Use: arena install <pack-name-or-url>\n'));
      return;
    }
    console.log(chalk.bold('\n  Installed Packs\n'));
    for (const [name, info] of Object.entries(installed)) {
      console.log(`  ${chalk.cyan(name.padEnd(25))} ${chalk.gray(info.challenge_count + ' challenges')}  ${chalk.gray(info.source)}`);
    }
    console.log('');
    return;
  }

  // Derive pack name from arg
  const packName = options.name || packNameOrUrl.replace(/[^a-z0-9-]/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '') || 'custom-pack';

  console.log(chalk.yellow(`\n  Installing pack "${packName}" from ${packNameOrUrl}...`));

  let result;
  try {
    result = await downloadPack(packNameOrUrl);
  } catch (err) {
    console.error(chalk.red(`  Failed: ${err.message}\n`));
    process.exit(1);
  }

  const validation = validatePack(result.challenges);
  if (!validation.valid) {
    console.error(chalk.red(`  Pack validation failed:`));
    for (const e of validation.errors) console.error(chalk.red(`    • ${e}`));
    console.log('');
    process.exit(1);
  }

  installPack(packName, result.source, result.challenges);
  console.log(chalk.green(`  ✓ Installed ${result.challenges.length} challenges from "${packName}"\n`));
}
