const K = 32;
const DEFAULT_RATING = 1200;

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function newRating(currentRating, expected, actual) {
  return Math.round(currentRating + K * (actual - expected));
}

export function calculateEloChange(ratingA, ratingB, winner) {
  const expA = expectedScore(ratingA, ratingB);

  let actualA, actualB;
  if (winner === 'left') { actualA = 1; actualB = 0; }
  else if (winner === 'right') { actualA = 0; actualB = 1; }
  else { actualA = 0.5; actualB = 0.5; }

  const nrA = newRating(ratingA, expA, actualA);
  const nrB = newRating(ratingB, 1 - expA, actualB);

  return {
    newRatingA: nrA,
    newRatingB: nrB,
    deltaA: nrA - ratingA,
    deltaB: nrB - ratingB
  };
}

export { DEFAULT_RATING, K };
