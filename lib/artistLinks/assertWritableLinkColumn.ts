import { WRITABLE_LINK_COLUMNS } from "@/lib/artistLinks/const";

/**
 * Refuses a column a link write must not touch.
 *
 * @param columnName - The sanitized column name.
 * @returns Nothing; throws for an empty name, wallets, or anything off the whitelist.
 */
export function assertWritableLinkColumn(columnName: string): void {
  if (!columnName) throw new Error("Invalid column name");
  if (columnName === "wallets" || columnName === "wallet") {
    throw new Error("Wallets must be managed through dedicated array operations");
  }
  if (!WRITABLE_LINK_COLUMNS.has(columnName)) {
    throw new Error(`Column not in writable whitelist: ${columnName}`);
  }
}
