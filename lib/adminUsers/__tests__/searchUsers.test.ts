import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchUsers } from "@/lib/adminUsers/searchUsers";

const mock = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { select: mock.select } }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.select.mockReturnValue({ from: mock.from });
  mock.from.mockReturnValue({ where: mock.where });
  mock.where.mockReturnValue({ orderBy: mock.orderBy });
});

describe("searchUsers", () => {
  it("returns each matching user's id, username and wallet", async () => {
    const rows = [{ id: "u1", username: "dutchyyy", wallet: null }];
    mock.orderBy.mockResolvedValueOnce(rows);
    expect(await searchUsers("dutch")).toEqual(rows);
    expect(Object.keys(mock.select.mock.calls[0][0])).toEqual(["id", "username", "wallet"]);
    expect(mock.where).toHaveBeenCalledTimes(1);
  });

  it("is empty when nobody matches", async () => {
    mock.orderBy.mockResolvedValueOnce([]);
    expect(await searchUsers("zzz")).toEqual([]);
  });
});
