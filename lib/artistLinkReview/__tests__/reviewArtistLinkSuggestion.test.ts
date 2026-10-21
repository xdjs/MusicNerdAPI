import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { fakeTransaction } from "./fakeTransaction";

const m = vi.hoisted(() => ({
  tx: undefined as unknown,
  lock: vi.fn(),
  platformLocks: vi.fn(),
  activity: vi.fn(async () => "act-1"),
  approveUgc: vi.fn(),
  approveSourceBacked: vi.fn(),
  queue: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({
  db: { transaction: async (fn: (t: unknown) => unknown) => fn(m.tx) },
}));
vi.mock("@/lib/artistLinkReview/lockLinkReview", () => ({ lockLinkReview: m.lock }));
vi.mock("@/lib/artistLinks/acquireArtistPlatformWriteLocks", () => ({
  acquireArtistPlatformWriteLocks: m.platformLocks,
}));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: m.activity }));
vi.mock("@/lib/artistLinkReview/approveUGC", () => ({ approveUGC: m.approveUgc }));
vi.mock("@/lib/artistLinkReview/approveSourceBackedUgc", () => ({
  approveSourceBackedUgc: m.approveSourceBacked,
}));
vi.mock("@/lib/sourceExtraction/queueApprovedSourceExtraction", () => ({
  queueApprovedSourceExtraction: m.queue,
}));
const { reviewArtistLinkSuggestion } =
  await import("@/lib/artistLinkReview/reviewArtistLinkSuggestion");

const ID = "0f3a7c62-1d7e-4b1e-9a7a-5b1f0c0e2a11";
const review = { userId: "u1", sourceId: ID, trigger: "artist_link_review" };
const DIFFERENT =
  "A different account is already connected. Remove the existing link before approving this replacement.";
const ugcRow = (over: Record<string, unknown> = {}) => ({
  id: ID,
  ugc_url: "https://www.instagram.com/p3t3rango/",
  site_name: "instagram",
  site_username: "p3t3rango",
  accepted: false,
  date_processed: null,
  ...over,
});
const sourceRow = (over: Record<string, unknown> = {}) => ({
  id: ID,
  url: "https://music.apple.com/us/artist/pete/123",
  type: "profile",
  status: "pending",
  podcast_episode_key: null,
  file_path: null,
  extracted_text: null,
  ...over,
});
const run = (results: unknown[][], input: Record<string, string>) => {
  const tx = fakeTransaction(results);
  m.tx = tx;
  return {
    tx,
    done: reviewArtistLinkSuggestion("a1", "u1", { id: ID, ...input } as never),
  };
};

beforeEach(() => vi.clearAllMocks());

describe("reviewArtistLinkSuggestion: UGC", () => {
  it("approves: platform hint, lock, row lock, conflict checks, write, activity", async () => {
    const { tx, done } = run(
      [
        [{ site_name: "instagram", site_username: "p3t3rango" }],
        [ugcRow()],
        [{ instagram: null }],
        [],
      ],
      { kind: "ugc", decision: "approve" },
    );
    await done;
    const [hint, row, artist, existing] = tx.statements();
    expect(hint.text).toBe(
      "select site_name,site_username from ugcresearch where id=$1::uuid and artist_id=$2::uuid",
    );
    expect(row.text).toBe(
      'select * from "ugcresearch" where id=$1::uuid and artist_id=$2::uuid for update',
    );
    expect(artist.text).toBe("select * from artists where id=$1::uuid");
    expect(existing.text).toContain("s.status='approved' and s.id<>$2::uuid");
    expect(existing.text).toContain("<>'link_hidden'");
    expect(m.platformLocks).not.toHaveBeenCalled();
    expect(m.lock).toHaveBeenCalledWith(tx, "a1", "u1");
    expect(m.approveUgc).toHaveBeenCalledWith(ID, "a1", "instagram", "p3t3rango", tx);
    expect(m.activity).toHaveBeenCalledWith("a1", "link_approved", review, tx);
  });

  it("takes the spotify/deezer platform locks before the review lock", async () => {
    const { done } = run(
      [
        [{ site_name: "spotify", site_username: "S1" }],
        [
          ugcRow({
            site_name: "spotify",
            site_username: "S1",
            ugc_url: "https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF",
          }),
        ],
        [{}],
        [],
      ],
      { kind: "ugc", decision: "approve" },
    );
    await done;
    expect(m.platformLocks).toHaveBeenCalledWith(m.tx, "a1", "spotify", "S1");
    expect(m.platformLocks.mock.invocationCallOrder[0]).toBeLessThan(
      m.lock.mock.invocationCallOrder[0],
    );
  });

  it("dismisses without writing the artist", async () => {
    const { tx, done } = run([[], [ugcRow()]], { kind: "ugc", decision: "dismiss" });
    await done;
    expect(tx.statements()[2].text).toBe(
      "update ugcresearch set accepted=false,date_processed=now(),updated_at=now() where id=$1::uuid",
    );
    expect(m.approveUgc).not.toHaveBeenCalled();
    expect(m.activity).toHaveBeenCalledWith("a1", "link_rejected", review, tx);
  });

  it("files an Apple Music suggestion as a Lore source", async () => {
    const row = ugcRow({
      ugc_url: "https://music.apple.com/us/artist/pete/123",
      site_name: "applemusic",
    });
    const { tx, done } = run([[], [row], [{}], []], { kind: "ugc", decision: "approve" });
    await done;
    expect(m.approveSourceBacked).toHaveBeenCalledWith(tx, "a1", "u1", row);
    expect(m.approveUgc).not.toHaveBeenCalled();
  });

  it("409s a different account already in the column", async () => {
    const { done } = run([[], [ugcRow()], [{ instagram: "someone" }]], {
      kind: "ugc",
      decision: "approve",
    });
    await expect(done).rejects.toEqual(new ArtistLinkConflictError(DIFFERENT));
    expect(m.approveUgc).not.toHaveBeenCalled();
  });

  it("409s an already reviewed or missing suggestion, and a release", async () => {
    await expect(
      run([[], [ugcRow({ accepted: true })]], { kind: "ugc", decision: "approve" }).done,
    ).rejects.toThrow("This suggestion has already been reviewed. Refresh the profile.");
    await expect(run([[], []], { kind: "ugc", decision: "approve" }).done).rejects.toThrow(
      "This suggestion is no longer available. Refresh the profile.",
    );
    await expect(
      run([[], [ugcRow({ ugc_url: "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy" })]], {
        kind: "ugc",
        decision: "approve",
      }).done,
    ).rejects.toThrow("This is not an artist profile link. Review it in Lore.");
  });

  it("refuses remove and restore on UGC", async () => {
    await expect(run([[], [ugcRow()]], { kind: "ugc", decision: "remove" }).done).rejects.toThrow(
      "Only an approved source link can be removed here.",
    );
    await expect(run([[], [ugcRow()]], { kind: "ugc", decision: "restore" }).done).rejects.toThrow(
      "Only an approved source link can be restored.",
    );
  });
});

describe("reviewArtistLinkSuggestion: sources", () => {
  it("approves a pending source, records it and queues its extraction", async () => {
    const { tx, done } = run([[sourceRow()], [{}], []], { kind: "source", decision: "approve" });
    await done;
    const statements = tx.statements();
    expect(statements[0].text).toBe(
      'select * from "artist_vault_sources" where id=$1::uuid and artist_id=$2::uuid for update',
    );
    expect(statements[3].text).toBe(
      "update artist_vault_sources set status=$1::source_status,updated_at=now() where id=$2::uuid",
    );
    expect(statements[3].params).toEqual(["approved", ID]);
    expect(m.activity).toHaveBeenCalledWith("a1", "source_approved", review, tx);
    expect(m.queue).toHaveBeenCalledWith(
      tx,
      {
        id: ID,
        artistId: "a1",
        url: "https://music.apple.com/us/artist/pete/123",
        status: "approved",
        filePath: null,
        extractedText: null,
      },
      "act-1",
    );
  });

  it("dismisses a pending source without queueing", async () => {
    const { tx, done } = run([[sourceRow()]], { kind: "source", decision: "dismiss" });
    await done;
    expect(tx.statements()[1].params).toEqual(["rejected", ID]);
    expect(m.activity).toHaveBeenCalledWith("a1", "source_rejected", review, tx);
    expect(m.queue).not.toHaveBeenCalled();
  });

  it("hides and shows an approved source's icon", async () => {
    const removed = run([[sourceRow({ status: "approved" })]], {
      kind: "source",
      decision: "remove",
    });
    await removed.done;
    expect(m.activity).toHaveBeenCalledWith("a1", "link_hidden", review, removed.tx);
    const restored = run([[sourceRow({ status: "approved" })], [{}], []], {
      kind: "source",
      decision: "restore",
    });
    await restored.done;
    expect(m.activity).toHaveBeenLastCalledWith("a1", "link_shown", review, restored.tx);
    expect(restored.tx.statements()).toHaveLength(3);
  });

  it("409s a different account on the artist or among visible approved sources", async () => {
    await expect(
      run([[sourceRow()], [{ apple_music: "999" }]], { kind: "source", decision: "approve" }).done,
    ).rejects.toThrow(DIFFERENT);
    await expect(
      run(
        [[sourceRow()], [{}], [{ id: "s2", url: "https://music.apple.com/us/artist/other/456" }]],
        {
          kind: "source",
          decision: "approve",
        },
      ).done,
    ).rejects.toThrow(DIFFERENT);
  });

  it("409s a source that isn't an artist destination", async () => {
    await expect(
      run([[sourceRow({ url: "https://news.test/a", type: "article" })]], {
        kind: "source",
        decision: "approve",
      }).done,
    ).rejects.toThrow("This is not an artist profile link. Review it in Lore.");
  });
});
