import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockTransaction } from "@/lib/account/__tests__/mockTransaction";

const outside = () => {
  throw new Error("statement outside the transaction");
};
const transaction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({
  db: { transaction, select: outside, update: outside, insert: outside },
}));
const { addUserBookmarks } = await import("@/lib/account/addUserBookmarks");

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

describe("addUserBookmarks", () => {
  it("locks the account, inserts only missing existing artists first, in one transaction", async () => {
    const { log } = setup([
      [{ id: USER }],
      [stored(A)],
      [{ id: C }, { id: B }],
      [view(B), view(C), view(A)],
    ]);
    const nonexistent = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    expect(await addUserBookmarks(USER, [B, A, C, B, nonexistent])).toEqual([
      view(B),
      view(C),
      view(A),
    ]);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(log.map(({ kind }) => kind)).toEqual([
      "select for update",
      "select",
      "select",
      "insert on conflict do update",
      "update",
      "select",
    ]);
    expect(log[0].params).toEqual([USER]);
    expect(log[2].params).toEqual([B, C, nonexistent]);
    expect(log[3].rows).toEqual([
      { userId: USER, artistId: B, position: 0 },
      { userId: USER, artistId: C, position: 1 },
    ]);
    expect(log[3].values).toEqual({ removedAt: null });
    expect(log[4].values).toMatchObject({ position: { params: [B, 0, C, 1, A, 2] } });
    expect(log[4].params).toEqual([USER, B, C, A]);
  });

  it("an import does not resurrect a removed bookmark", async () => {
    const { log } = setup([[{ id: USER }], [], [{ id: A }], [view(A)]]);
    await addUserBookmarks(USER, [A], true);
    expect(log[3].kind).toBe("insert on conflict do nothing");
  });

  it("repeated adds are idempotent and do not move an existing bookmark", async () => {
    const { log } = setup([[{ id: USER }], [stored(B), stored(A)], [view(B), view(A)]]);
    expect(await addUserBookmarks(USER, [A, A])).toEqual([view(B), view(A)]);
    expect(log.map(({ kind }) => kind)).toEqual(["select for update", "select", "select"]);
  });

  it("does not write for an account removed since the token was issued", async () => {
    const { log } = setup([[]]);
    await expect(addUserBookmarks(USER, [A])).rejects.toThrow("Bookmark account no longer exists");
    expect(log).toHaveLength(1);
  });
});
