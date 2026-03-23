import { streamModel } from './streamer.js';
import { stripMarkdownFences } from '../utils/markdown.js';
import { validateChallenge } from '../challenges/validator.js';

const EXAMPLE_CHALLENGE = `{
  "id": "binary-search",
  "title": "Binary Search with Edge Cases",
  "category": "algorithms",
  "difficulty": "easy",
  "prompt": "Write a function binary_search(arr, target) that returns the index of target in a sorted array, or -1 if not found. Handle empty arrays and single-element arrays.",
  "language": "python",
  "tests": [
    { "name": "found in middle", "setup": "", "run": "result = binary_search([1,2,3,4,5], 3)", "assert": "result == 2" },
    { "name": "not found", "setup": "", "run": "result = binary_search([1,2,3], 4)", "assert": "result == -1" },
    { "name": "empty array", "setup": "", "run": "result = binary_search([], 1)", "assert": "result == -1" }
  ],
  "qualitative_checks": [
    { "id": "iterative", "description": "Uses iterative approach", "patterns": ["while"] }
  ]
}`;

export function buildGeneratorPrompt(userPrompt, options = {}) {
  const language = options.language || 'python';
  const difficulty = options.difficulty || 'medium';

  return `You are a coding challenge designer. Generate a challenge in JSON format.

USER REQUEST: ${userPrompt}

REQUIREMENTS:
- Language: ${language}
- Difficulty: ${difficulty}
- Write 4-8 tests that cover normal cases, edge cases, and error cases
- Tests must be self-contained (each test is independent)
- The "run" field should be a single expression or short statement that sets "result"
- The "assert" field should be a boolean expression comparing "result" to expected value
- The "setup" field is for any initialization needed before "run"
- Include 1-3 qualitative checks with regex patterns
- The id must be kebab-case

OUTPUT FORMAT (JSON only, no explanation):
${EXAMPLE_CHALLENGE}

Generate the challenge JSON now. Output ONLY the JSON, nothing else.`;
}

export async function generateChallenge(provider, userPrompt, options = {}) {
  const prompt = buildGeneratorPrompt(userPrompt, options);
  const result = await streamModel(provider, prompt, options.onToken || (() => {}));
  const raw = stripMarkdownFences(result.code);

  let challenge;
  try {
    challenge = JSON.parse(raw);
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Model did not return valid JSON. Raw output:\n' + raw.slice(0, 500));
    challenge = JSON.parse(jsonMatch[0]);
  }

  // Apply overrides
  if (options.language) challenge.language = options.language;
  if (options.difficulty) challenge.difficulty = options.difficulty;

  // Validate
  const validation = validateChallenge(challenge);
  if (!validation.valid) {
    throw new Error(`Generated challenge failed validation:\n${validation.errors.join('\n')}`);
  }

  return { challenge, generation_time_ms: result.generation_time_ms };
}
