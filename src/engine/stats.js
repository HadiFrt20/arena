/**
 * Unbiased pass@k estimator from Chen et al. 2021.
 * n = total samples, c = correct samples, k = budget
 * pass@k = 1 - C(n-c, k) / C(n, k)
 */
export function passAtK(n, c, k) {
  if (n < k) return c > 0 ? 1.0 : 0.0;
  if (c === 0) return 0.0;
  if (c >= n) return 1.0;
  if (n - c < k) return 1.0;
  let logResult = 0;
  for (let i = 0; i < k; i++) {
    logResult += Math.log(n - c - i) - Math.log(n - i);
  }
  return 1.0 - Math.exp(logResult);
}
