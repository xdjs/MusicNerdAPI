/**
 * Undoes digit-for-letter swaps handles use when the plain name is taken
 * (`p3t3rango` for "Pete Rango").
 *
 * @param s - A handle.
 * @returns It with 0 1 3 4 5 7 read as o i e a s t.
 */
export function deleetHandle(s: string): string {
  return s
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t");
}
