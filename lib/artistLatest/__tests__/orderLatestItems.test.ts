import { describe, it, expect } from "vitest";
import { orderLatestItems } from "@/lib/artistLatest/orderLatestItems";

const now = Date.UTC(2026, 9, 21);

describe("orderLatestItems", () => {
  it("sorts newest first, ties by id, partial dates at their period end", () => {
    const items = [
      { id: "b", date: "2026-10-01" },
      { id: "a", date: "2026-10-01" },
      { id: "c", date: "2026-09" },
      { id: "d", date: "2026-10-02T00:00:00.000Z" },
    ];
    expect(orderLatestItems(items, now).map(i => i.id)).toEqual(["d", "a", "b", "c"]);
  });

  it("drops undated, future-dated and repeated cards", () => {
    const items = [
      { id: "a", date: "2026-10-01" },
      { id: "a", date: "2026-10-02" },
      { id: "future", date: "2026-12-01" },
      { id: "bad", date: "soon" },
    ];
    expect(orderLatestItems(items, now)).toEqual([{ id: "a", date: "2026-10-01" }]);
  });
});
