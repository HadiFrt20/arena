import { jest } from '@jest/globals';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CLI = join(process.cwd(), 'bin', 'arena.js');
const run = (args) => execSync(`node ${CLI} ${args}`, { encoding: 'utf-8', timeout: 10000 });

describe('CLI commands UAT', () => {
  test('arena --help shows all commands', () => {
    const output = run('--help');
    expect(output).toContain('battle');
    expect(output).toContain('list');
    expect(output).toContain('leaderboard');
    expect(output).toContain('replay');
    expect(output).toContain('config');
  });

  test('arena --version shows version number', () => {
    const output = run('--version');
    expect(output.trim()).toBe('1.0.0');
  });

  test('arena list: shows all 20 challenges', () => {
    const output = run('list');
    expect(output).toContain('ALGORITHMS');
    expect(output).toContain('DATA-STRUCTURES');
    expect(output).toContain('WEB');
    expect(output).toContain('CLI');
    expect(output).toContain('fizzbuzz');
    expect(output).toContain('kv-store-ttl');
    expect(output).toContain('lru-cache');
    expect(output).toContain('csv-parser');
    expect(output).toContain('20 total');
  });

  test('arena list output format: categories, difficulties, IDs', () => {
    const output = run('list');
    expect(output).toContain('easy');
    expect(output).toContain('medium');
    expect(output).toContain('hard');
    expect(output).toContain('python');
  });

  test('arena leaderboard: shows table headers', () => {
    const output = run('leaderboard');
    expect(output).toContain('Model');
    expect(output).toContain('ELO');
  });

  test('arena config: displays provider info', () => {
    const output = run('config');
    expect(output).toContain('Providers');
    expect(output).toContain('anthropic');
    expect(output).toContain('openai');
    expect(output).toContain('Aliases');
    expect(output).toContain('claude');
  });

  test('arena replay nonexistent-id: shows error', () => {
    try {
      run('replay nonexistent-battle-id-xyz');
      fail('Should have thrown');
    } catch (err) {
      expect(err.status).not.toBe(0);
    }
  });

  test('arena battle help: shows options', () => {
    const output = run('battle --help');
    expect(output).toContain('--left');
    expect(output).toContain('--right');
    expect(output).toContain('--language');
    expect(output).toContain('--random');
  });

  test('arena replay with seeded battle file', () => {
    const battlesDir = join(homedir(), '.arena', 'battles');
    mkdirSync(battlesDir, { recursive: true });
    const battleId = 'battle-test-replay-' + Date.now();
    const battleFile = join(battlesDir, `${battleId}.json`);
    const battleData = {
      id: battleId,
      timestamp: new Date().toISOString(),
      challenge: 'fizzbuzz',
      models: {
        left: { provider: 'anthropic', model: 'claude', alias: 'claude' },
        right: { provider: 'openai', model: 'gpt4o', alias: 'gpt4o' }
      },
      results: {
        left: { code: 'x', generation_time_ms: 1000, lines_of_code: 1, tests_passed: 5, tests_total: 5, test_details: [], execution_time_ms: 100, qualitative: {} },
        right: { code: 'y', generation_time_ms: 2000, lines_of_code: 2, tests_passed: 3, tests_total: 5, test_details: [], execution_time_ms: 200, qualitative: {} }
      },
      scores: { left: 85, right: 60 },
      winner: 'left',
      elo_delta: 16,
      integrity_hash: 'sha256:abc'
    };
    writeFileSync(battleFile, JSON.stringify(battleData));

    try {
      const output = run(`replay ${battleId}`);
      expect(output).toContain('RESULTS');
      expect(output).toContain('claude');
    } finally {
      try { rmSync(battleFile); } catch {}
    }
  });
});
