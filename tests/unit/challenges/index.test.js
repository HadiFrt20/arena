import { jest } from '@jest/globals';
import {
  getAllChallenges,
  getChallenge,
  getRandomChallenge,
  getChallengesByCategory,
  loadCustomChallenge
} from '../../../src/challenges/index.js';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('challenges index', () => {
  test('load all 20 built-in challenges', () => {
    const all = getAllChallenges('builtin');
    expect(all.length).toBe(20);
  });

  test('each challenge has required fields', () => {
    const all = getAllChallenges();
    for (const c of all) {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('title');
      expect(c).toHaveProperty('category');
      expect(c).toHaveProperty('difficulty');
      expect(c).toHaveProperty('prompt');
      expect(c).toHaveProperty('language');
      expect(c).toHaveProperty('tests');
      expect(typeof c.id).toBe('string');
      expect(typeof c.title).toBe('string');
      expect(typeof c.prompt).toBe('string');
      expect(typeof c.language).toBe('string');
      expect(Array.isArray(c.tests)).toBe(true);
    }
  });

  test('each challenge has at least 1 test', () => {
    const all = getAllChallenges();
    for (const c of all) {
      expect(c.tests.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('challenge IDs are unique', () => {
    const all = getAllChallenges();
    const ids = all.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('categories are valid', () => {
    const validCategories = new Set(['algorithms', 'data-structures', 'web', 'cli']);
    const all = getAllChallenges('builtin');
    for (const c of all) {
      expect(validCategories.has(c.category)).toBe(true);
    }
  });

  test('difficulties are valid', () => {
    const validDifficulties = new Set(['easy', 'medium', 'hard']);
    const all = getAllChallenges();
    for (const c of all) {
      expect(validDifficulties.has(c.difficulty)).toBe(true);
    }
  });

  test('getChallenge by ID returns correct challenge', () => {
    const fizzbuzz = getChallenge('fizzbuzz');
    expect(fizzbuzz).not.toBeNull();
    expect(fizzbuzz.id).toBe('fizzbuzz');
    expect(fizzbuzz.title).toBe('FizzBuzz');
  });

  test('getChallenge with non-existent ID returns null', () => {
    const result = getChallenge('nonexistent-challenge-xyz');
    expect(result).toBeNull();
  });

  test('getChallengesByCategory returns grouped results', () => {
    const grouped = getChallengesByCategory();
    expect(grouped).toHaveProperty('algorithms');
    expect(grouped).toHaveProperty('data-structures');
    expect(grouped).toHaveProperty('web');
    expect(grouped).toHaveProperty('cli');
    expect(grouped['algorithms'].length).toBe(5);
    expect(grouped['data-structures'].length).toBe(5);
  });

  test('getRandomChallenge returns a valid challenge', () => {
    const c = getRandomChallenge();
    expect(c).toBeDefined();
    expect(c).toHaveProperty('id');
    expect(c).toHaveProperty('tests');
  });

  test('getRandomChallenge returns different challenges (probabilistic)', () => {
    const ids = new Set();
    for (let i = 0; i < 50; i++) {
      ids.add(getRandomChallenge().id);
    }
    // With 20 challenges and 50 draws, we should get at least 2 different ones
    expect(ids.size).toBeGreaterThan(1);
  });

  test('loadCustomChallenge from file path', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'arena-custom-'));
    const filePath = join(tempDir, 'custom.json');
    const challenge = {
      id: 'custom-test',
      title: 'Custom Test',
      category: 'algorithms',
      difficulty: 'easy',
      prompt: 'Do something',
      language: 'python',
      tests: [{ name: 'test', setup: '', run: 'result = 1', assert: 'result == 1' }]
    };
    writeFileSync(filePath, JSON.stringify(challenge));
    const loaded = loadCustomChallenge(filePath);
    expect(loaded.id).toBe('custom-test');
    expect(loaded.title).toBe('Custom Test');
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('loadCustomChallenge with malformed JSON throws', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'arena-custom-'));
    const filePath = join(tempDir, 'bad.json');
    writeFileSync(filePath, 'not json {{{');
    expect(() => loadCustomChallenge(filePath)).toThrow();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('each test in each challenge has name, run, and assert', () => {
    const all = getAllChallenges();
    for (const c of all) {
      for (const t of c.tests) {
        expect(t).toHaveProperty('name');
        expect(t).toHaveProperty('run');
        expect(t).toHaveProperty('assert');
        expect(typeof t.name).toBe('string');
        expect(typeof t.run).toBe('string');
        expect(typeof t.assert).toBe('string');
      }
    }
  });
});
