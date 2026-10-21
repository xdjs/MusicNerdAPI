import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActivityHandler } from "@/lib/activityFeed/getActivityHandler";

const mock = vi.hoisted(() => ({ recent: vi.fn() }));
vi.mock("@/lib/activityFeed/getRecentActivity", () => ({ getRecentActivity: mock.recent }));
beforeEach(() => vi.clearAllMocks());

describe("getActivityHandler", () => {
  it("returns the events in the feed's field names, with `mapping:` stripped from the platform", async () => {
    mock.recent.mockResolvedValue([
      {
        type: "agent_mapping",
        artist_id: "a1",
        artist_name: "Bio Ritmo",
        platform: "mapping:deezer",
        created_at: "2026-10-20T10:00:00+00:00",
      },
      {
        type: "artist_added",
        artist_id: "a2",
        artist_name: "Celia Cruz",
        platform: null,
        created_at: "2026-10-20T09:00:00+00:00",
      },
    ]);
    const response = await getActivityHandler(
      new Request("https://example.org/api/activity?since=2026-10-19T00:00:00Z"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(mock.recent).toHaveBeenCalledWith("2026-10-19T00:00:00Z");
    expect(await response.json()).toEqual({
      status: "ok",
      events: [
        {
          type: "agent_mapping",
          artistId: "a1",
          artistName: "Bio Ritmo",
          platform: "deezer",
          createdAt: "2026-10-20T10:00:00+00:00",
        },
        {
          type: "artist_added",
          artistId: "a2",
          artistName: "Celia Cruz",
          platform: null,
          createdAt: "2026-10-20T09:00:00+00:00",
        },
      ],
    });
  });

  it("rejects a bad `since` with 400 before querying", async () => {
    const response = await getActivityHandler(
      new Request("https://example.org/api/activity?since=nope"),
    );
    expect(response.status).toBe(400);
    expect(mock.recent).not.toHaveBeenCalled();
  });

  it("answers 500 when the feed can't be read", async () => {
    mock.recent.mockRejectedValue(new Error("db down"));
    const response = await getActivityHandler(new Request("https://example.org/api/activity"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "error", error: "Failed to fetch activity" });
  });
});
