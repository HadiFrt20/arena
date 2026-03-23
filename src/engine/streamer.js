import { startTimer } from '../utils/timer.js';

export async function streamModel(provider, prompt, onToken) {
  const timer = startTimer();
  let fullOutput = '';

  try {
    for await (const token of provider.stream(prompt)) {
      fullOutput += token;
      onToken(token);
    }
  } catch (err) {
    onToken(`\n\n[ERROR: ${err.message}]`);
    fullOutput += `\n\n[ERROR: ${err.message}]`;
  }

  return {
    code: fullOutput,
    generation_time_ms: Math.round(timer.elapsed())
  };
}
