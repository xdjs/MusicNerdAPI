/**
 * Rounds to one decimal place.
 *
 * @param n - The number.
 * @returns It, to one decimal.
 */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
