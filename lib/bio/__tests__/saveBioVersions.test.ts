import { describe, it, expect, vi } from "vitest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
import { saveBioVersions } from "@/lib/bio/saveBioVersions";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import type { SQL } from "drizzle-orm";
function tx() {
  const execute = vi.fn(async (q: SQL) =>
    renderSql(q).text.startsWith("insert into artist_bio_versions") ? [{ id: "version" }] : [],
  );
  return { execute };
}
describe("saveBioVersions", () => {
  it("keeps both sides of an edit with private history sidecars", async () => {
    const t = tx();
    await saveBioVersions(
      t as never,
      "artist",
      ["Old bio", "New bio"],
      [null, { kind: "unknown" }],
    );
    const calls = t.execute.mock.calls.map(([q]) => renderSql(q));
    expect(
      calls.filter(q => q.text.startsWith("insert into artist_bio_versions")).map(q => q.params),
    ).toEqual([
      ["artist", "Old bio"],
      ["artist", "New bio"],
    ]);
    expect(
      calls
        .filter(q => q.text.startsWith("insert into mn_private.artist_bio_version_provenance"))
        .map(q => q.params),
    ).toEqual([["version", JSON.stringify({ kind: "unknown" })]]);
    expect(calls[0].text).toContain("p.provenance is not distinct from");
  });
  it("skips equal text and lineage and ignores empty state", async () => {
    const t = tx();
    t.execute.mockResolvedValueOnce([{ id: "existing" }]);
    await saveBioVersions(t as never, "artist", ["Saved", null, " ", ABOUT_EMPTY_STATE, "New"]);
    expect(
      t.execute.mock.calls
        .map(([q]) => renderSql(q).text)
        .filter(q => q.startsWith("insert into artist_bio_versions")),
    ).toHaveLength(1);
  });
  it("fails the caller transaction if version identity is unavailable", async () => {
    const t = { execute: vi.fn(async () => []) };
    await expect(saveBioVersions(t as never, "artist", ["New"])).rejects.toThrow(
      "Could not save About history",
    );
  });
});
