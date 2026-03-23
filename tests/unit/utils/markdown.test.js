import { jest } from '@jest/globals';
import { stripMarkdownFences } from '../../../src/utils/markdown.js';

describe('stripMarkdownFences', () => {
  test('input with ```python\\ncode\\n``` returns just the code', () => {
    const input = '```python\ndef add(a, b):\n    return a + b\n```';
    expect(stripMarkdownFences(input)).toBe('def add(a, b):\n    return a + b');
  });

  test('input with ```\\ncode\\n``` (no language) returns just the code', () => {
    const input = '```\ndef foo():\n    pass\n```';
    expect(stripMarkdownFences(input)).toBe('def foo():\n    pass');
  });

  test('input with ```javascript\\ncode\\n``` returns just the code', () => {
    const input = '```javascript\nfunction add(a, b) { return a + b; }\n```';
    expect(stripMarkdownFences(input)).toBe('function add(a, b) { return a + b; }');
  });

  test('prose before and after fences returns just the code', () => {
    const input = 'Here is my solution:\n\n```python\ndef add(a, b):\n    return a + b\n```\n\nThis solution handles all edge cases.';
    expect(stripMarkdownFences(input)).toBe('def add(a, b):\n    return a + b');
  });

  test('multiple code blocks are concatenated', () => {
    const input = 'First class:\n\n```python\nclass Foo:\n    pass\n```\n\nSecond class:\n\n```python\nclass Bar:\n    pass\n```\n\nDone!';
    expect(stripMarkdownFences(input)).toBe('class Foo:\n    pass\n\nclass Bar:\n    pass');
  });

  test('input with no fences returns as-is (trimmed)', () => {
    const input = 'def add(a, b):\n    return a + b';
    expect(stripMarkdownFences(input)).toBe('def add(a, b):\n    return a + b');
  });

  test('pure prose with no fences returns as-is', () => {
    const input = 'I cannot help with that request.';
    expect(stripMarkdownFences(input)).toBe('I cannot help with that request.');
  });

  test('empty input returns empty string', () => {
    expect(stripMarkdownFences('')).toBe('');
    expect(stripMarkdownFences(null)).toBe('');
    expect(stripMarkdownFences(undefined)).toBe('');
  });

  test('fence with trailing whitespace', () => {
    const input = '```python\nprint("hello")\n```   \n\n';
    expect(stripMarkdownFences(input)).toBe('print("hello")');
  });

  test('nested backticks inside code are preserved', () => {
    const input = '```python\nx = "`not a fence`"\nprint(x)\n```';
    expect(stripMarkdownFences(input)).toBe('x = "`not a fence`"\nprint(x)');
  });

  test('code block with blank lines preserved', () => {
    const input = '```python\ndef foo():\n    pass\n\ndef bar():\n    pass\n```';
    expect(stripMarkdownFences(input)).toBe('def foo():\n    pass\n\ndef bar():\n    pass');
  });
});
