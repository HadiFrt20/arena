export function calculateScore(result, opponentResult, challenge) {
  const testsTotal = result.tests_total || 1;
  const testScore = (result.tests_passed / testsTotal) * 60;

  // Speed bonus: faster generation wins
  const myTime = result.generation_time_ms || 1;
  const oppTime = opponentResult.generation_time_ms || 1;
  const speedRatio = myTime <= oppTime ? 1.0 : oppTime / myTime;
  const speedBonus = speedRatio * 15;

  // Brevity bonus: fewer lines wins
  const myLines = result.lines_of_code || 1;
  const oppLines = opponentResult.lines_of_code || 1;
  const brevityRatio = myLines <= oppLines ? 1.0 : oppLines / myLines;
  const brevityBonus = brevityRatio * 10;

  // Qualitative bonus
  const qualChecks = Object.values(result.qualitative || {});
  const qualTotal = qualChecks.length || 1;
  const qualPassed = qualChecks.filter(Boolean).length;
  const qualBonus = (qualPassed / qualTotal) * 15;

  return Math.round((testScore + speedBonus + brevityBonus + qualBonus) * 100) / 100;
}

export function determineWinner(leftScore, rightScore) {
  const diff = Math.abs(leftScore - rightScore);
  if (diff <= 2) return 'draw';
  return leftScore > rightScore ? 'left' : 'right';
}
