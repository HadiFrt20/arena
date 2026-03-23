export function buildPrompt(challenge) {
  return `You are participating in a coding challenge. Write a complete, working solution.

CHALLENGE: ${challenge.title}
LANGUAGE: ${challenge.language}

${challenge.prompt}

RULES:
- Output ONLY the code. No explanations, no markdown fences, no comments about the solution.
- The code must be a single file that can run standalone.
- Use only standard library imports unless the challenge specifies otherwise.
- The solution should be production-quality: handle edge cases, use appropriate data structures.`;
}
