import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({ db: { query: { users: { findFirst } } } }));
const { getUserByWallet } = await import("@/lib/account/getUserByWallet");

beforeEach(() => {
  findFirst.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getUserByWallet", () => {
  it("matches the wallet case-insensitively, lower-cased", async () => {
    findFirst.mockResolvedValueOnce({ id: "u1" });
    expect(await getUserByWallet("0xABC")).toEqual({ id: "u1" });
    const { text, params } = renderSql(findFirst.mock.calls[0][0].where);
    expect(text).toBe('"users"."wallet" ilike $1');
    expect(params).toEqual(["0xabc"]);
  });

  it("is undefined when no account has the wallet", async () => {
    findFirst.mockResolvedValueOnce(undefined);
    expect(await getUserByWallet("0xabc")).toBeUndefined();
  });

  it("wraps a database error", async () => {
    findFirst.mockRejectedValueOnce(new Error("Connection refused"));
    await expect(getUserByWallet("0xabc")).rejects.toThrow(
      "Error finding user: Connection refused",
    );
  });
});
