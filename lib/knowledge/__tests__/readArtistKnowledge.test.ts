import { beforeEach, describe, expect, it, vi } from "vitest";
import { readArtistKnowledge } from "@/lib/knowledge/readArtistKnowledge";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { artistId, rawKnowledge, social, vault } from "./fixtures";

const m = vi.hoisted(() => ({ transaction: vi.fn(), execute: vi.fn(), authorize: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/knowledge/authorizeArtistKnowledge", () => ({
  authorizeArtistKnowledge: m.authorize,
}));
const original = { version: 1, kind: "vault", ...vault };
const old = normalizeArtistKnowledge({ ...rawKnowledge, vault: [vault] }).sources[0];
const changed = { ...original, title: "Corrected title", extractedText: "Updated original" };
const query = {
  operation: "read" as const,
  sourceId: old.metadata.sourceId,
  revision: old.metadata.revision,
  start: 0,
  maxChars: 1000,
  includeVersion: true,
};
const capturedAt = "2026-10-06T12:00:00.000Z";
const tx = { execute: m.execute };
beforeEach(() => {
  vi.resetAllMocks();
  m.authorize.mockResolvedValue(rawKnowledge.artist);
  m.transaction.mockImplementation(async fn => fn(tx));
  m.execute
    .mockResolvedValueOnce([{ snapshot: changed, chars: 500 }])
    .mockResolvedValueOnce([{ rows: 1, chars: 500 }])
    .mockResolvedValueOnce([{ snapshot: original, capturedAt }]);
});

describe("exact retained original reads", () => {
  it("reopens old text and metadata with an explicit historical marker and current revision", async () => {
    const result = await readArtistKnowledge(artistId, "caller", query);
    expect(result.passage.text).toBe(vault.extractedText);
    expect(result.passage.source).toEqual(old.metadata);
    expect(result.version).toEqual({
      state: "historical",
      capturedAt,
      currentRevision: normalizeArtistKnowledge({ ...rawKnowledge, vault: [changed] }).sources[0]
        .metadata.revision,
    });
    expect(m.authorize).toHaveBeenCalledWith(tx, artistId, "caller");
    expect(m.transaction.mock.calls[0][1]).toEqual({
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
    for (const [sql] of m.execute.mock.calls) expect(renderSql(sql).params).toContain(artistId);
  });
  it("reads one current source without touching history or unrelated corpus tables", async () => {
    m.execute.mockReset().mockResolvedValueOnce([{ snapshot: original, chars: 500 }]);
    const result = await readArtistKnowledge(artistId, "caller", query);
    expect(result.version).toEqual({
      state: "current",
      currentRevision: old.metadata.revision,
      capturedAt: null,
    });
    expect(m.execute).toHaveBeenCalledOnce();
    const sql = renderSql(m.execute.mock.calls[0][0]);
    expect(sql.params).toContain(vault.id);
    expect(sql.text).not.toContain("artist_interview_answers");
  });
  it("preserves legacy current-only shape and changed-revision behavior without opt-in", async () => {
    await expect(
      readArtistKnowledge(artistId, "caller", { ...query, includeVersion: false }),
    ).rejects.toMatchObject({ status: 409, code: "revision_changed" });
    expect(m.execute).toHaveBeenCalledOnce();
    m.execute.mockReset().mockResolvedValueOnce([{ snapshot: original, chars: 500 }]);
    expect(
      await readArtistKnowledge(artistId, "caller", { ...query, includeVersion: false }),
    ).not.toHaveProperty("version");
  });
  it("does not expose history after approval, artist membership or parent eligibility changes", async () => {
    for (const snapshot of [
      null,
      { ...changed, status: "rejected" },
      { ...changed, artistId: social.id },
    ]) {
      m.execute.mockReset().mockResolvedValueOnce(snapshot ? [{ snapshot, chars: 500 }] : []);
      await expect(readArtistKnowledge(artistId, "caller", query)).rejects.toMatchObject({
        status: 404,
      });
      expect(m.execute).toHaveBeenCalledOnce();
    }
    m.authorize.mockRejectedValue(new KnowledgeError("forbidden", 403, "Not authorized"));
    m.execute.mockClear();
    await expect(readArtistKnowledge(artistId, "caller", query)).rejects.toMatchObject({
      status: 403,
    });
    expect(m.execute).not.toHaveBeenCalled();
  });
  it.each(["caption", "transcript"])(
    "reopens retained social %s using its original provider provenance",
    async kind => {
      const current = {
        version: 1,
        kind: "social",
        ...social,
        caption: "Edited caption",
        transcript: { ...(social.transcript as object), text: "Edited speech" },
      };
      const sources = normalizeArtistKnowledge({ ...rawKnowledge, social: [social] }).sources;
      const evidence = sources.find(s => s.metadata.sourceId.endsWith(kind))!;
      m.execute
        .mockReset()
        .mockResolvedValueOnce([{ snapshot: current, chars: 500 }])
        .mockResolvedValueOnce([{ rows: 1, chars: 500 }])
        .mockResolvedValueOnce([
          { snapshot: { version: 1, kind: "social", ...social }, capturedAt },
        ]);
      const result = await readArtistKnowledge(artistId, "caller", {
        ...query,
        sourceId: evidence.metadata.sourceId,
        revision: evidence.metadata.revision,
      });
      expect(result.passage.text).toBe(evidence.text);
      expect(result.passage.source.provenance).toEqual(evidence.metadata.provenance);
      expect(JSON.stringify(result)).not.toContain("provider-secret");
    },
  );
  it.each([{ isOwnPost: false }, { isRepost: true }, { isRetweet: true }, { transcript: null }])(
    "denies old speech when the current source is ineligible: %j",
    async flags => {
      m.execute
        .mockReset()
        .mockResolvedValueOnce([
          { snapshot: { version: 1, kind: "social", ...social, ...flags }, chars: 500 },
        ]);
      await expect(
        readArtistKnowledge(artistId, "caller", {
          ...query,
          sourceId: `social:${social.id}:transcript`,
        }),
      ).rejects.toMatchObject({ status: 404 });
      expect(m.execute).toHaveBeenCalledOnce();
    },
  );
  it("never substitutes a new revision or another artist's archived original", async () => {
    m.execute
      .mockReset()
      .mockResolvedValueOnce([{ snapshot: changed, chars: 500 }])
      .mockResolvedValueOnce([{ rows: 1, chars: 500 }])
      .mockResolvedValueOnce([{ snapshot: { ...original, artistId: social.id }, capturedAt }]);
    await expect(readArtistKnowledge(artistId, "caller", query)).rejects.toMatchObject({
      status: 409,
      code: "revision_changed",
    });
  });
  it.each([
    { rows: 513, chars: 500 },
    { rows: 1, chars: 4_000_001 },
  ])("fails explicitly before transferring oversized history: %j", async size => {
    m.execute
      .mockReset()
      .mockResolvedValueOnce([{ snapshot: changed, chars: 500 }])
      .mockResolvedValueOnce([size]);
    await expect(readArtistKnowledge(artistId, "caller", query)).rejects.toMatchObject({
      status: 413,
      code: "revision_history_too_large",
    });
    expect(m.execute).toHaveBeenCalledTimes(2);
  });
  it("propagates storage and malformed snapshot failures rather than reporting no history", async () => {
    m.execute.mockReset().mockRejectedValue(new Error("storage"));
    await expect(readArtistKnowledge(artistId, "caller", query)).rejects.toThrow("storage");
    m.execute
      .mockReset()
      .mockResolvedValueOnce([
        { snapshot: { kind: "vault", extractedText: "incomplete" }, chars: 50 },
      ]);
    await expect(readArtistKnowledge(artistId, "caller", query)).rejects.toThrow();
  });
});
