import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const mock = vi.hoisted(() => ({ set: vi.fn(), where: vi.fn(), returning: vi.fn() }));
vi.mock("@/lib/db/db", () => ({
  db: {
    update: () => ({
      set: (values: unknown) => {
        mock.set(values);
        return {
          where: (condition: unknown) => {
            mock.where(condition);
            return { returning: mock.returning };
          },
        };
      },
    }),
  },
}));
const { linkWalletToUser } = await import("@/lib/account/linkWalletToUser");

beforeEach(() => {
  mock.set.mockReset();
  mock.where.mockReset();
  mock.returning.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("linkWalletToUser", () => {
  it("rejects an invalid wallet before writing", async () => {
    for (const wallet of ["not-a-wallet", "0x123", ""])
      await expect(linkWalletToUser("u1", wallet)).rejects.toThrow("Invalid wallet address format");
    expect(mock.set).not.toHaveBeenCalled();
  });

  it("writes the wallet lower-cased on the account", async () => {
    const wallet = "0xABCDEF1234567890ABCDEF1234567890ABCDEF12";
    mock.returning.mockResolvedValueOnce([{ id: "u1", wallet: wallet.toLowerCase() }]);
    expect(await linkWalletToUser("u1", wallet)).toEqual({
      id: "u1",
      wallet: wallet.toLowerCase(),
    });
    expect(mock.set).toHaveBeenCalledWith({
      wallet: wallet.toLowerCase(),
      updatedAt: expect.any(String),
    });
    expect(renderSql(mock.where.mock.calls[0][0]).params).toEqual(["u1"]);
  });

  it("wraps a database error", async () => {
    mock.returning.mockRejectedValueOnce(new Error("DB error"));
    await expect(
      linkWalletToUser("u1", "0x1234567890abcdef1234567890abcdef12345678"),
    ).rejects.toThrow("Error linking wallet to user");
  });
});
