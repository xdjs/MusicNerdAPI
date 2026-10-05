import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchRun } from "@/lib/vault/__tests__/searchRun";

const h = vi.hoisted(() => ({
  ambiguous: vi.fn(async () => false),
  belongs: vi.fn(async () => false),
  contradicts: vi.fn(async () => false),
  getArtistById: vi.fn(async (): Promise<Record<string, string | null>> => ({
    id: "a1",
    name: "Pete Rango",
    instagram: null,
    x: null,
  })),
  confirms: vi.fn(async (c: { title: string }) => c.title || null),
  writeArtistLink: vi.fn(async (..._a: unknown[]) => {}),
}));
vi.mock("@/lib/identity/nameIsAmbiguousInDirectory", () => ({
  nameIsAmbiguousInDirectory: h.ambiguous,
}));
vi.mock("@/lib/identity/handleBelongsToAnotherArtist", () => ({
  handleBelongsToAnotherArtist: h.belongs,
}));
vi.mock("@/lib/identity/contradictsScrapedPosts", () => ({
  contradictsScrapedPosts: h.contradicts,
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: h.getArtistById }));
vi.mock("@/lib/vault/accountPageConfirms", () => ({ accountPageConfirms: h.confirms }));
vi.mock("@/lib/vault/writeArtistLink", () => ({ writeArtistLink: h.writeArtistLink }));
const { verifyAccountCandidates } = await import("@/lib/vault/verifyAccountCandidates");

const cand = (siteName: string, id: string, title = "Pete Rango") => ({
  siteName,
  id,
  url: `https://${siteName}.com/${id}`,
  title,
  description: "",
});
const run = (accountCandidates: ReturnType<typeof cand>[]) =>
  searchRun({ artistName: "Pete Rango", accountCandidates });
beforeEach(() => {
  for (const f of [h.ambiguous, h.belongs, h.contradicts]) f.mockReset().mockResolvedValue(false);
  h.writeArtistLink.mockClear();
  h.getArtistById
    .mockReset()
    .mockResolvedValue({ id: "a1", name: "Pete Rango", instagram: null, x: null });
});

describe("verifyAccountCandidates", () => {
  it("writes a confirmed account, once per platform, and counts its handle as verified", async () => {
    const r = run([
      cand("instagram", "p3t3rango"),
      cand("instagram", "other"),
      cand("x", "p3t3rango"),
    ]);
    await verifyAccountCandidates(r);
    expect(h.writeArtistLink.mock.calls.map(c => `${c[1]}=${c[2]}`)).toEqual([
      "instagram=p3t3rango",
      "x=p3t3rango",
    ]);
    expect([...r.verifiedHandles]).toEqual(["p3t3rango"]);
  });

  it("skips the whole pass when another artist's name starts with this one", async () => {
    h.ambiguous.mockResolvedValueOnce(true);
    await verifyAccountCandidates(run([cand("instagram", "p3t3rango")]));
    expect(h.writeArtistLink).not.toHaveBeenCalled();
  });

  it("leaves a platform the artist holds, another artist's handle, a contradicted one and an unconfirmed page alone", async () => {
    h.getArtistById.mockResolvedValueOnce({
      id: "a1",
      name: "Pete Rango",
      instagram: "p3t3rango",
      x: null,
    });
    h.belongs.mockResolvedValueOnce(true);
    await verifyAccountCandidates(
      run([cand("instagram", "p3t3rango"), cand("x", "taken"), cand("x", "fake", "")]),
    );
    expect(h.writeArtistLink).not.toHaveBeenCalled();
  });

  it("never fails the run: an error here keeps what was already found", async () => {
    h.getArtistById.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    h.writeArtistLink.mockImplementationOnce(async () => {
      throw new Error("conflict");
    });
    await expect(verifyAccountCandidates(run([cand("x", "p3t3rango")]))).resolves.toBeUndefined();
    h.confirms.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    await expect(verifyAccountCandidates(run([cand("x", "p3t3rango")]))).resolves.toBeUndefined();
  });
});

describe("verifyAccountCandidates with provisional columns", () => {
  it("replaces a column that holds only a discovery guess, and passes the set to the write", async () => {
    h.getArtistById.mockResolvedValueOnce({
      id: "a1",
      name: "Pete Rango",
      instagram: "guess",
      x: null,
    });
    const r = run([cand("instagram", "p3t3rango")]);
    r.provisional = new Set(["instagram"]);
    await verifyAccountCandidates(r);
    expect(h.writeArtistLink).toHaveBeenCalledWith(
      "a1",
      "instagram",
      "p3t3rango",
      r.provisional,
      expect.objectContaining({ instagram: "guess" }),
    );
  });
});

it.each([false, true])(
  "does not write after the account check consumes the deadline (durable %s)",
  async requireComplete => {
    let now = 1000;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
      h.confirms.mockImplementationOnce(async () => {
        now = 3000;
        return "Pete Rango";
      });
      const pending = verifyAccountCandidates({
        ...run([cand("instagram", "p3t3rango")]),
        deadline: 2000,
        requireComplete,
      });
      if (requireComplete) await expect(pending).rejects.toThrow("deadline");
      else await pending;
      expect(h.writeArtistLink).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  },
);
