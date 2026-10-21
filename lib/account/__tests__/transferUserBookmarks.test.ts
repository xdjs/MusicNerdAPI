import { describe, it, expect } from "vitest";
import { mockTransaction } from "@/lib/account/__tests__/mockTransaction";
import { transferUserBookmarks } from "@/lib/account/transferUserBookmarks";

const USER = "11111111-1111-4111-8111-111111111111";
const LEGACY = "22222222-2222-4222-8222-222222222222";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const date = "2026-09-06T12:00:00Z";
const stored = (artistId: string) => ({ artistId, createdAt: date });

describe("transferUserBookmarks", () => {
  it("merges the bookmark union with the target's order and creation times preserved", async () => {
    const { tx, log } = mockTransaction([
      [stored(B), stored(A)],
      [
        { ...stored(A), removedAt: null },
        { ...stored(C), removedAt: null },
      ],
    ]);
    await transferUserBookmarks(tx as never, USER, LEGACY);
    expect(log.map(({ kind }) => kind)).toEqual([
      "select",
      "select",
      "insert on conflict do nothing",
      "update",
    ]);
    expect(log[0].params).toEqual([LEGACY]);
    expect(log[1].params).toEqual([USER]);
    expect(log[2].rows).toEqual([
      { userId: LEGACY, artistId: C, createdAt: date, removedAt: null, position: 2 },
    ]);
    expect(log[3].values).toMatchObject({ position: { params: [B, 0, A, 1, C, 2] } });
    expect(log[3].params).toEqual([LEGACY, B, A, C]);
  });

  it("writes nothing when the placeholder adds no artists", async () => {
    const { tx, log } = mockTransaction([[stored(A)], [{ ...stored(A), removedAt: null }]]);
    await transferUserBookmarks(tx as never, USER, LEGACY);
    expect(log.map(({ kind }) => kind)).toEqual(["select", "select"]);
  });
});
