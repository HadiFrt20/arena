import chalk from 'chalk';
import { list as listProviders } from '../models/registry.js';
import { ensureProvidersLoaded } from '../models/bootstrap.js';
import { describeProvider } from '../utils/provider-describe.js';

/**
 * `arena providers` — enumerate every self-registered provider in the live
 * registry, with the capabilities that only exist on the declaration (auth
 * style, endpoint, stream style/terminator, key source).
 *
 * Reflects over registry.list() + each declaration's `capabilities` — NOT
 * loadConfig(), whose deriveProviders() only surfaces api_key_env/base_url and
 * would render header-auth providers (Azure) wrong.
 */
export async function providersCommand() {
  // Belt-and-braces: config.js/factory.js already trigger the dir-scan via
  // top-level await, but this command touches neither, so ensure the scan has
  // run itself so all providers appear even if imported in isolation.
  await ensureProvidersLoaded();

  const rows = listProviders().map(describeProvider);

  console.log('');
  console.log(chalk.cyan('  ╔' + '═'.repeat(52) + '╗'));
  console.log(chalk.cyan('  ║') + chalk.bold.cyan('  🔌  Registered Providers'));
  console.log(chalk.cyan('  ╚' + '═'.repeat(52) + '╝'));
  console.log(chalk.gray(`\n  ${rows.length} provider${rows.length === 1 ? '' : 's'} in the live registry\n`));

  // Column widths sized to content so the list stays aligned and readable.
  const headers = { name: 'PROVIDER', auth: 'AUTH', stream: 'STREAM', keySource: 'KEY / BASE URL' };
  const widths = {};
  for (const col of ['name', 'auth', 'stream', 'keySource']) {
    widths[col] = Math.max(headers[col].length, ...rows.map((r) => r[col].length));
  }

  const headerLine =
    '  ' +
    chalk.bold(headers.name.padEnd(widths.name)) + '  ' +
    chalk.bold(headers.auth.padEnd(widths.auth)) + '  ' +
    chalk.bold(headers.stream.padEnd(widths.stream)) + '  ' +
    chalk.bold(headers.keySource.padEnd(widths.keySource));
  console.log(headerLine);
  console.log(chalk.gray.dim('  ' + '─'.repeat(widths.name + widths.auth + widths.stream + widths.keySource + 6)));

  for (const r of rows) {
    console.log(
      '  ' +
      chalk.white.bold(r.name.padEnd(widths.name)) + '  ' +
      chalk.cyan(r.auth.padEnd(widths.auth)) + '  ' +
      chalk.magenta(r.stream.padEnd(widths.stream)) + '  ' +
      chalk.gray(r.keySource.padEnd(widths.keySource))
    );
    // Endpoint on its own indented line — templates ({model}/{resource}/...) are
    // long and would blow out the table width.
    console.log('  ' + chalk.gray.dim('   ↳ ' + r.endpoint));
  }

  console.log('');
}
