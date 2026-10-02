import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  clear: vi.fn(),
  set: vi.fn(),
  extract: vi.fn(),
  unsafe: vi.fn(),
  route: vi.fn(),
  blocked: vi.fn(),
}));
vi.mock("@/lib/artistLinks/clearArtistLink", () => ({ clearArtistLink: m.clear }));
vi.mock("@/lib/artistLinks/setArtistLink", () => ({ setArtistLink: m.set }));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId: m.extract }));
vi.mock("@/lib/pages/isUnsafeUrl", () => ({ isUnsafeUrl: m.unsafe }));
vi.mock("@/lib/onboarding/routeLinkToVault", () => ({ routeLinkToVault: m.route }));
vi.mock("@/lib/onboarding/linkIsIdentityBlocked", () => ({ linkIsIdentityBlocked: m.blocked }));
const { applyProfileLinkDecisions } = await import("@/lib/onboarding/applyProfileLinkDecisions");

beforeEach(() => {
  m.clear.mockReset().mockResolvedValue({ oldValue: "x" });
  m.set.mockReset().mockResolvedValue({ oldValue: null, artistName: "Nova" });
  m.extract
    .mockReset()
    .mockImplementation(async (url: string) =>
      url.includes("instagram.com/")
        ? { siteName: "instagram", id: url.split("/").pop(), cardPlatformName: "Instagram" }
        : null,
    );
  m.unsafe.mockReset().mockReturnValue(false);
  m.route.mockReset().mockResolvedValue("routedToVaultPending");
  m.blocked.mockReset().mockResolvedValue(false);
});

describe("applyProfileLinkDecisions", () => {
  it("clears removals, writes recognised profiles and routes anything else to the vault", async () => {
    const outcome = await applyProfileLinkDecisions(
      "a1",
      [{ url: "instagram.com/nova" }, { url: "https://nova.com" }],
      ["tiktok"],
    );
    expect(m.clear).toHaveBeenCalledWith("a1", "tiktok");
    expect(m.set).toHaveBeenCalledWith("a1", "instagram", "nova");
    expect(m.route).toHaveBeenCalledWith(
      expect.objectContaining({ artistId: "a1" }),
      "https://nova.com",
    );
    expect(outcome).toEqual({
      written: ["instagram"],
      identityBlocked: [],
      unrecognized: [],
      writeRejected: [],
      routedToVaultApproved: [],
      routedToVaultPending: ["https://nova.com"],
      vaultInsertFailed: [],
    });
    expect(m.blocked).not.toHaveBeenCalled();
  });

  it("keeps going when a removal fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.clear.mockRejectedValueOnce(new Error("lock"));
    await applyProfileLinkDecisions("a1", [], ["tiktok", "x"]);
    expect(m.clear).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it("buckets a bad, unsafe or unparseable URL as unrecognized and a refused write as writeRejected", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.unsafe.mockImplementation((u: string) => u.includes("10.0.0.1"));
    m.extract.mockImplementationOnce(async () => {
      throw new Error("urlmap");
    });
    m.set.mockRejectedValueOnce(new Error("already linked"));
    const outcome = await applyProfileLinkDecisions(
      "a1",
      [
        { url: "not a url" },
        { url: "http://10.0.0.1/x" },
        { url: "instagram.com/boom" },
        { url: "instagram.com/taken" },
      ],
      [],
    );
    expect(outcome.unrecognized).toEqual([
      "not a url",
      "http://10.0.0.1/x",
      "https://instagram.com/boom",
    ]);
    expect(outcome.writeRejected).toEqual(["https://instagram.com/taken"]);
    error.mockRestore();
  });

  it("with verifyIdentity, refuses a handle the guards don't clear", async () => {
    m.blocked.mockResolvedValueOnce(true);
    const outcome = await applyProfileLinkDecisions("a1", [{ url: "instagram.com/other" }], [], {
      verifyIdentity: true,
    });
    expect(m.blocked).toHaveBeenCalledWith(
      expect.objectContaining({ artistId: "a1" }),
      "instagram",
      "other",
    );
    expect(outcome.identityBlocked).toEqual(["https://instagram.com/other"]);
    expect(m.set).not.toHaveBeenCalled();
  });
});
