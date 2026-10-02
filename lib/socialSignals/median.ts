/**
 * The median of a list of numbers.
 *
 * @param nums - The numbers.
 * @returns The middle value (the mean of the two middles for an even list); 0 when empty.
 */
export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
