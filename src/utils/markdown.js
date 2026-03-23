/**
 * Extracts code from model output that may contain markdown fences and prose.
 *
 * Handles:
 * - ```python\ncode\n``` or ```javascript\ncode\n``` or ```\ncode\n```
 * - Prose before and after fences (stripped)
 * - Multiple code blocks (concatenated with newlines)
 * - No fences at all (returned as-is)
 */
export function stripMarkdownFences(text) {
  if (!text) return '';

  const fencePattern = /```[\w]*\n([\s\S]*?)```/g;
  const blocks = [];
  let match;

  while ((match = fencePattern.exec(text)) !== null) {
    const content = match[1].trim();
    if (content) {
      blocks.push(content);
    }
  }

  if (blocks.length > 0) {
    return blocks.join('\n\n');
  }

  // No fences found — return as-is (trimmed)
  return text.trim();
}
