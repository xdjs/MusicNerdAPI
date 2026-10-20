import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const { execute, setName } = vi.hoisted(() => ({ execute: vi.fn(), setName: vi.fn() }));
vi.mock("@/lib/db/db", () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn({ execute }) },
}));
vi.mock("@/lib/whitelistUser/setRequestedUserName", () => ({ setRequestedUserName: setName }));
const { updateWhitelistedUser } = await import("@/lib/whitelistUser/updateWhitelistedUser");

const dialect = new PgDialect();
const update = () => dialect.sqlToQuery(execute.mock.calls[0][0] as SQL);

beforeEach(() => {
  execute.mockReset().mockResolvedValue([]);
  setName.mockReset();
});

describe("updateWhitelistedUser", () => {
  it("auto-whitelists a new admin and ignores isWhiteListed", async () => {
    const result = await updateWhitelistedUser("u1", { isAdmin: true, isWhiteListed: false });
    expect(result).toEqual({ status: "success", message: "User updated successfully" });
    expect(update().sql).toBe(
      "update users set is_admin = $1, is_white_listed = true where id = $2::uuid",
    );
    expect(update().params).toEqual([true, "u1"]);
  });

  it("sets wallet, email, whitelist and hidden flags", async () => {
    await updateWhitelistedUser("u1", {
      wallet: "0x1",
      email: "e",
      isWhiteListed: true,
      isHidden: false,
    });
    expect(update().sql).toContain("wallet = $1, email = $2, is_white_listed = $3, is_hidden = $4");
  });

  it("renames through setRequestedUserName and succeeds with nothing else to set", async () => {
    expect(await updateWhitelistedUser("u1", { username: "Pete" })).toEqual({
      status: "success",
      message: "User updated successfully",
    });
    expect(setName).toHaveBeenCalledWith({ execute }, "u1", "Pete");
    expect(execute).not.toHaveBeenCalled();
  });

  it("is an error with no fields", async () => {
    expect(await updateWhitelistedUser("u1", {})).toEqual({
      status: "error",
      message: "No fields to update",
    });
  });
});
