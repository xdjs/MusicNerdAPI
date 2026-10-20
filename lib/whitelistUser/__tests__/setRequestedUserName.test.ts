import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { setRequestedUserName } from "@/lib/whitelistUser/setRequestedUserName";

const dialect = new PgDialect();
const execute = vi.fn();
const tx = { execute } as unknown as Parameters<typeof setRequestedUserName>[0];
const queries = () => execute.mock.calls.map(([q]) => dialect.sqlToQuery(q as SQL));

beforeEach(() => execute.mockReset());

describe("setRequestedUserName", () => {
  it("locks, checks the name is free and saves it confirmed", async () => {
    execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ wallet: "0xabc" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await setRequestedUserName(tx, "u1", "  Pete  ");
    const q = queries();
    expect(q[0].sql).toContain("pg_advisory_xact_lock(1387)");
    expect(q[2].params).toEqual(["u1", "Pete"]);
    expect(q[3].sql).toContain("username_needs_confirmation = false");
    expect(q[3].params).toEqual(["Pete", "u1"]);
  });

  it("rejects an invalid name before touching the database", async () => {
    await expect(setRequestedUserName(tx, "u1", "me@x.com")).rejects.toThrow(
      "Choose a user name instead of an email or wallet address.",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects the user's own wallet as a name", async () => {
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ wallet: "pete" }]);
    await expect(setRequestedUserName(tx, "u1", "Pete")).rejects.toThrow(
      "Choose a user name instead of an email or wallet address.",
    );
  });

  it("rejects a taken name", async () => {
    execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ wallet: null }])
      .mockResolvedValueOnce([{ id: "u2" }]);
    await expect(setRequestedUserName(tx, "u1", "Pete")).rejects.toThrow("already taken");
  });

  it("rejects an unknown account", async () => {
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await expect(setRequestedUserName(tx, "u1", "Pete")).rejects.toThrow("Account not found.");
  });
});
