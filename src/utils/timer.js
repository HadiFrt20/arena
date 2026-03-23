export function startTimer() {
  const start = process.hrtime.bigint();
  return {
    elapsed() {
      return Number(process.hrtime.bigint() - start) / 1e6; // ms
    }
  };
}
