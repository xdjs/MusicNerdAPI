import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { fakeTransaction } from "./fakeTransaction";

const m = vi.hoisted(() => ({ activity: vi.fn(), queue: vi.fn() }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: m.activity }));
vi.mock("@/lib/sourceExtraction/queueApprovedSourceExtraction", () => ({
  queueApprovedSourceExtraction: m.queue,
}));
const { approveSourceBackedUgc } = await import("@/lib/artistLinkReview/approveSourceBackedUgc");

const row = {
  id: "g1",
  ugc_url: "https://music.apple.com/us/artist/pete/123",
  site_name: "applemusic",
  origin: "submission",
  created_at: "2026-10-01 00:00:00",
  user_id: "u2",
};

beforeEach(() => {
  vi.clearAllMocks();
  m.activity.mockResolvedValueOnce("act-submitted").mockResolvedValueOnce("act-review");
});

describe("approveSourceBackedUgc", () => {
  it("files the page as an approved source with the original contributor and date", async () => {
    const tx = fakeTransaction([[{ id: "s1" }]]);
    await approveSourceBackedUgc(tx as never, "a1", "u1", row);
    const [insert, link, accept] = tx.statements();
    expect(insert.text).toContain(
      "insert into artist_vault_sources(artist_id,url,title,type,status,origin,created_at)",
    );
    expect(insert.text).toContain("'profile','approved'");
    expect(insert.text).toContain("on conflict(artist_id,url) do nothing returning id");
    expect(insert.params).toEqual(["a1", row.ugc_url, "applemusic", "submission", row.created_at]);
    expect(m.activity).toHaveBeenNthCalledWith(
      1,
      "a1",
      "source_submission",
      { sourceId: "s1", userId: "u2", actorKind: "unknown", trigger: "legacy_link_submission" },
      tx,
    );
    expect(link.params).toEqual(["act-submitted", "s1"]);
    expect(m.activity).toHaveBeenNthCalledWith(
      2,
      "a1",
      "source_approved",
      { sourceId: "s1", userId: "u1", trigger: "artist_link_review" },
      tx,
    );
    expect(m.queue).toHaveBeenCalledWith(
      tx,
      { id: "s1", artistId: "a1", url: row.ugc_url, status: "approved" },
      "act-review",
    );
    expect(accept.text).toBe(
      "update ugcresearch set accepted=true,date_processed=now(),updated_at=now() where id=$1::uuid",
    );
    expect(accept.params).toEqual(["g1"]);
  });

  it("attributes research to the system and defaults a missing origin and date", async () => {
    const tx = fakeTransaction([[{ id: "s1" }]]);
    await approveSourceBackedUgc(tx as never, "a1", "u1", {
      ...row,
      origin: "research",
      user_id: null,
      created_at: null,
    });
    expect(m.activity.mock.calls[0][2]).toMatchObject({ userId: undefined, actorKind: "system" });
    expect(tx.statements()[0].params[4]).toBeNull();
  });

  it("409s a URL already in Lore", async () => {
    await expect(
      approveSourceBackedUgc(fakeTransaction([[]]) as never, "a1", "u1", row),
    ).rejects.toEqual(
      new ArtistLinkConflictError("This URL already exists in Lore. Review that source instead."),
    );
    expect(m.activity).not.toHaveBeenCalled();
  });
});
