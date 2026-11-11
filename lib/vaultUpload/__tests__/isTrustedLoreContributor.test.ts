import { it, expect, vi } from "vitest";
import { isTrustedLoreContributor } from "../isTrustedLoreContributor";
const read = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({ db: { query: { users: { findFirst: read } } } }));
it.each([
  { user: undefined, allowed: false },
  { user: { isAdmin: false, isWhiteListed: false }, allowed: false },
  { user: { isAdmin: true, isWhiteListed: false }, allowed: true },
  { user: { isAdmin: false, isWhiteListed: true }, allowed: true },
])("admits only current trusted accounts: $allowed", async ({ user, allowed }) => {
  read.mockResolvedValue(user);
  expect(await isTrustedLoreContributor("user")).toBe(allowed);
});
