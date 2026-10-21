import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockTransaction } from "@/lib/account/__tests__/mockTransaction";

const outside = () => {
  throw new Error("statement outside the transaction");
};
const transaction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({
  db: { transaction, select: outside, update: outside, insert: outside },
}));
const { editUserBookmarks } = await import("@/lib/account/editUserBookmarks");

const USER = "11111111-1111-4111-8111-111111111111";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const date = "2026-09-06T12:00:00Z";
const stored = (artistId: string) => ({ artistId, createdAt: date });
const view = (artistId: string) => ({ artistId, artistName: `Artist ${artistId}`, imageUrl: null });

function setup(results: unknown[][]) {
  const { tx, log } = mockTransaction(results);
  transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  return { tx, log };
}

beforeEach(() => {
  transaction.mockReset();
});

describe("editUserBookmarks", () => {
  it("stale reorders retain concurrently added entries and cannot resurrect removed entries", async () => {
    const { log } = setup([[{ id: USER }], [stored(C), stored(A)], [view(C), view(A)]]);
    expect(await editUserBookmarks(USER, [B, A], [B])).toEqual([view(C), view(A)]);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(log.map(({ kind }) => kind)).toEqual([
      "select for update",
      "update",
      "select",
      "update",
      "select",
    ]);
    expect(log[1].values).toEqual({ removedAt: expect.any(String) });
    expect(log[1].params).toEqual([USER, B]);
    expect(log[3].values).toMatchObject({ position: { params: [C, 0, A, 1] } });
    expect(log[3].params).toEqual([USER, C, A]);
  });

  it("reorders without a removal statement when nothing is removed", async () => {
    const { log } = setup([[{ id: USER }], [stored(A), stored(B)], [view(B), view(A)]]);
    expect(await editUserBookmarks(USER, [B, A], [])).toEqual([view(B), view(A)]);
    expect(log.map(({ kind }) => kind)).toEqual([
      "select for update",
      "select",
      "update",
      "select",
    ]);
    expect(log[2].values).toMatchObject({ position: { params: [B, 0, A, 1] } });
  });
});
