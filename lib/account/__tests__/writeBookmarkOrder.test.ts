import { describe, it, expect } from "vitest";
import { mockTransaction } from "@/lib/account/__tests__/mockTransaction";
import { writeBookmarkOrder } from "@/lib/account/writeBookmarkOrder";

const USER = "11111111-1111-4111-8111-111111111111";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("writeBookmarkOrder", () => {
  it("writes each listed position in one CASE statement scoped to the account", async () => {
    const { tx, log } = mockTransaction();
    await writeBookmarkOrder(tx as never, USER, [B, A]);
    expect(log).toHaveLength(1);
    const position = log[0].values?.position as { text: string; params: unknown[] };
    expect(position.text).toBe(
      'CASE "user_artist_bookmarks"."artist_id" WHEN $1::uuid THEN $2::integer WHEN $3::uuid THEN $4::integer ELSE "user_artist_bookmarks"."position" END',
    );
    expect(position.params).toEqual([B, 0, A, 1]);
    expect(log[0].params).toEqual([USER, B, A]);
  });

  it("does nothing for an empty order", async () => {
    const { tx, log } = mockTransaction();
    await writeBookmarkOrder(tx as never, USER, []);
    expect(log).toEqual([]);
  });
});
