import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { listPendingSubmissions } from "@/lib/contributorApprovals/listPendingSubmissions";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

const item = (n: number) => ({
  id: `id-${n}`,
  type: "link",
  title: "instagram",
  url: "https://instagram.com/x",
  artistName: "Dutchyyy",
});

beforeEach(() => vi.clearAllMocks());

describe("listPendingSubmissions", () => {
  it("returns the contributor's pending links and Lore sources", async () => {
    mock.execute.mockResolvedValueOnce([item(1)]);
    expect(await listPendingSubmissions("u1")).toEqual({ items: [item(1)], hasMore: false });
    const { text, params } = renderSql(mock.execute.mock.calls[0][0]);
    expect(text).toContain(
      "from ugcresearch g where g.user_id = $1::uuid and g.origin = 'submission'",
    );
    expect(text).toContain(
      "e.actor_user_id = $2::uuid and s.origin in ('submission', 'upload') and s.status = 'pending'",
    );
    expect(params).toEqual(["u1", "u1", 201]);
  });

  it("returns the first 200 and says there are more", async () => {
    mock.execute.mockResolvedValueOnce(Array.from({ length: 201 }, (_, n) => item(n)));
    const result = await listPendingSubmissions("u1");
    expect(result.items).toHaveLength(200);
    expect(result.hasMore).toBe(true);
  });
});
