import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({ db: { query: { users: { findFirst } } } }));
const { getUserById } = await import("@/lib/account/getUserById");

beforeEach(() => {
  findFirst.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getUserById", () => {
  it("reads the account by id", async () => {
    findFirst.mockResolvedValueOnce({ id: "u1", privyUserId: "did:privy:1" });
    expect(await getUserById("u1")).toEqual({ id: "u1", privyUserId: "did:privy:1" });
    expect(renderSql(findFirst.mock.calls[0][0].where).params).toEqual(["u1"]);
  });

  it("wraps a database error", async () => {
    findFirst.mockRejectedValueOnce(new Error("Connection refused"));
    await expect(getUserById("u1")).rejects.toThrow("Error finding user: Connection refused");
  });
});
