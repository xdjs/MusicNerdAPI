/**
 * One CSV cell, RFC 4180: always quoted, inner quotes doubled. Source titles
 * carry commas and quotation marks all the time.
 *
 * @param value - The cell's value.
 * @returns The quoted cell; "" for null or undefined.
 */
export function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
