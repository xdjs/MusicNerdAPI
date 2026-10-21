import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.execute } }));
const { getLatestRefresh } = await import("@/lib/latest/getLatestRefresh");

const row = (status: string, state: unknown) => ({
  id: "j",
  status,
  created_at: "2026-10-17T00:00:00Z",
  state,
});

beforeEach(() => {
  m.execute.mockReset().mockResolvedValue([]);
});

describe("getLatestRefresh", () => {
  it("returns null when no request is in scope", async () => {
    expect(await getLatestRefresh("artist")).toBeNull();
    expect(JSON.stringify(m.execute.mock.calls[0][0])).toContain("j.kind='latest_refresh'");
  });

  it("returns the editor view with every source and a 30-minute retry", async () => {
    m.execute.mockResolvedValue([
      row("pending", {
        userId: "u1",
        claimId: "c1",
        instagram: "handle",
        sources: {
          instagram: { status: "pending" },
          spotify: { status: "checked", checkedAt: "2026-10-17T00:01:00Z" },
        },
      }),
    ]);
    const result = await getLatestRefresh("artist");
    expect(result).toEqual({
      id: "j",
      status: "pending",
      requestedAt: "2026-10-17T00:00:00.000Z",
      sources: {
        instagram: { status: "pending" },
        inprocess: { status: "failed" },
        spotify: { status: "checked", checkedAt: "2026-10-17T00:01:00Z" },
        deezer: { status: "failed" },
        interviews: { status: "failed" },
      },
      retryAt: "2026-10-17T00:30:00.000Z",
    });
    expect(JSON.stringify(result)).not.toMatch(/u1|c1|handle/);
  });

  it("reports a source still pending on a finished request as failed", async () => {
    m.execute.mockResolvedValue([
      row("done", {
        sources: { instagram: { status: "pending" }, spotify: { status: "checked" } },
      }),
    ]);
    const result = await getLatestRefresh("artist");
    expect(result?.sources.instagram).toEqual({ status: "failed" });
    expect(result?.sources.spotify).toEqual({ status: "checked" });
  });

  it.each(["no_new_posts", "older_posts_found", "instagram_unavailable"])(
    "allows only safe Instagram detail %s",
    async detail => {
      m.execute.mockResolvedValue([
        row("done", {
          sources: { instagram: { status: "checked", detail, raw: "secret" } },
          instagramFailure: { reason: "private payload" },
        }),
      ]);
      const result = await getLatestRefresh("artist");
      expect(result?.sources.instagram).toEqual({ status: "checked", detail });
      expect(JSON.stringify(result)).not.toMatch(/secret|private payload/);
    },
  );

  it("drops unexpected provider text", async () => {
    m.execute.mockResolvedValue([
      row("done", {
        sources: {
          instagram: { status: "failed", detail: "secret raw provider text" },
          spotify: { status: "checked", detail: "no_new_posts" },
        },
      }),
    ]);
    const result = await getLatestRefresh("artist");
    expect(result?.sources.instagram).toEqual({ status: "failed" });
    expect(result?.sources.spotify).toEqual({ status: "checked" });
  });
});
