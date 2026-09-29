/**
 * A site name reduced to the characters a column name may have.
 *
 * @param siteName - The platform name.
 * @returns Letters, digits and underscores only.
 */
export function sanitizeColumnName(siteName: string): string {
  return siteName.replace(/[^a-zA-Z0-9_]/g, "");
}
