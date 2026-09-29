/**
 * One name, comparably: NFKD-decomposed, lowercased, diacritics and everything
 * not alphanumeric dropped. "Sigur Rós" and "sigur ros" fold to the same string,
 * and so do "Pharaoh Sistare" and "pharaohsistare".
 *
 * NFKD first, then lowercase: mathematical-bold capitals have no lowercase
 * form, so the other order strips them entirely.
 *
 * @param s - A name or handle.
 * @returns The folded form.
 */
export function foldName(s: string): string {
  return s
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
