#!/usr/bin/env node
/**
 * Generate the provider capabilities table from the LIVE registry and inject it
 * between stable markers in README.md and docs/PROVIDERS.md.
 *
 *   npm run gen:providers
 *
 * Reflects over registry.list() + each declaration's `capabilities` (via the
 * shared describers) — NOT loadConfig(), which only surfaces api_key_env /
 * base_url and would drop header-auth / endpoint / stream metadata (Azure).
 * The table is regenerated, never hand-maintained: edit a provider declaration
 * and re-run this script.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureProvidersLoaded } from '../src/models/bootstrap.js';
import { list as listProviders } from '../src/models/registry.js';
import { describeProvider } from '../src/utils/provider-describe.js';

const START = '<!-- PROVIDERS:START -->';
const END = '<!-- PROVIDERS:END -->';

const _dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(_dir, '..');

/** Escape Markdown table-breaking characters in a cell. */
function cell(value) {
  return String(value).replace(/\|/g, '\\|');
}

/** Build the Markdown table (+ generated-note) from the live registry. */
function buildTable() {
  const rows = listProviders().map(describeProvider);
  const lines = [];
  lines.push('| Provider | Auth | Endpoint | Stream (style / termination) | API-key env / base URL |');
  lines.push('|----------|------|----------|------------------------------|------------------------|');
  for (const r of rows) {
    lines.push(
      `| \`${cell(r.name)}\` | ${cell(r.auth)} | \`${cell(r.endpoint)}\` | ${cell(r.stream)} | \`${cell(r.keySource)}\` |`
    );
  }
  const note = `\n> _${rows.length} providers — generated from the live registry by \`npm run gen:providers\`. Do not edit by hand._`;
  return `${lines.join('\n')}\n${note}`;
}

/**
 * Replace the content between START/END markers in `text`. Throws if the
 * markers are missing so a drifted file fails loudly instead of silently.
 */
function inject(text, table, file) {
  const startIdx = text.indexOf(START);
  const endIdx = text.indexOf(END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`${file}: missing or malformed ${START} / ${END} markers`);
  }
  const before = text.slice(0, startIdx + START.length);
  const after = text.slice(endIdx);
  return `${before}\n${table}\n${after}`;
}

await ensureProvidersLoaded();
const table = buildTable();

for (const rel of ['README.md', join('docs', 'PROVIDERS.md')]) {
  const path = join(ROOT, rel);
  const original = readFileSync(path, 'utf-8');
  const updated = inject(original, table, rel);
  if (updated !== original) {
    writeFileSync(path, updated);
    console.log(`updated ${rel}`);
  } else {
    console.log(`unchanged ${rel}`);
  }
}
