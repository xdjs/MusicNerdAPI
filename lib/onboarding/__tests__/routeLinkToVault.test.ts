import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  unsafe: vi.fn(),
  sources: vi.fn(),
  preview: vi.fn(),
  name: vi.fn(),
  insert: vi.fn(),
  enrich: vi.fn(),
}));
vi.mock("@/lib/pages/isUnsafeUrl", () => ({ isUnsafeUrl: m.unsafe }));
vi.mock("@/lib/vault/getVaultSourcesByStatus", () => ({ getVaultSourcesByStatus: m.sources }));
vi.mock("@/lib/pages/fetchLinkPreview", () => ({ fetchLinkPreview: m.preview }));
vi.mock("@/lib/onboarding/artistNameForRun", () => ({ artistNameForRun: m.name }));
vi.mock("@/lib/vault/insertVaultSource", () => ({ insertVaultSource: m.insert }));
vi.mock("@/lib/onboarding/enrichVaultSource", () => ({ enrichVaultSource: m.enrich }));
const { routeLinkToVault } = await import("@/lib/onboarding/routeLinkToVault");

beforeEach(() => {
  m.unsafe.mockReset().mockReturnValue(false);
  m.sources.mockReset().mockResolvedValue([]);
  m.preview.mockReset().mockResolvedValue({ title: "Pete Rango — Official Site", imageUrl: null });
  m.name.mockReset().mockResolvedValue("Pete Rango");
  m.insert.mockReset().mockResolvedValue({ id: "new-src" });
  m.enrich.mockReset().mockResolvedValue(undefined);
});

describe("routeLinkToVault", () => {
  it("approves the artist's own site as a website source, then enriches it keeping the title", async () => {
    expect(await routeLinkToVault({ artistId: "a1" }, "https://peterango.com")).toBe(
      "routedToVaultApproved",
    );
    expect(m.insert).toHaveBeenCalledWith({
      artistId: "a1",
      url: "https://peterango.com",
      title: "Pete Rango — Official Site",
      type: "website",
      status: "approved",
    });
    expect(m.enrich).toHaveBeenCalledWith("new-src", "https://peterango.com", { keepTitle: true });
  });

  it("parks a page whose title isn't the artist's as pending, typed by URL", async () => {
    m.preview.mockResolvedValueOnce({ title: "Some Blog", imageUrl: null });
    expect(await routeLinkToVault({ artistId: "a1" }, "https://blog.com/post")).toBe(
      "routedToVaultPending",
    );
    expect(m.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", type: "article" }),
    );
  });

  it("is unrecognized for an unsafe URL or a page with no metadata", async () => {
    m.unsafe.mockReturnValueOnce(true);
    expect(await routeLinkToVault({ artistId: "a1" }, "http://10.0.0.1")).toBe("unrecognized");
    m.preview.mockResolvedValueOnce({ title: null, imageUrl: null });
    expect(await routeLinkToVault({ artistId: "a1" }, "https://dead.com")).toBe("unrecognized");
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("doesn't insert a URL already in the vault, and reads the vault once per run", async () => {
    m.sources.mockResolvedValueOnce([{ url: "https://peterango.com", status: "approved" }]);
    const run = { artistId: "a1" };
    expect(await routeLinkToVault(run, "https://peterango.com")).toBe("routedToVaultApproved");
    expect(await routeLinkToVault(run, "https://other.com")).toBe("routedToVaultApproved");
    expect(m.sources).toHaveBeenCalledTimes(1);
    expect(m.sources).toHaveBeenCalledWith("a1");
    expect(m.insert).toHaveBeenCalledTimes(1);
    expect(await routeLinkToVault(run, "https://other.com")).toBe("routedToVaultApproved");
    expect(m.insert).toHaveBeenCalledTimes(1);
  });

  it("reports a failed insert separately", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.insert.mockRejectedValueOnce(new Error("pool"));
    expect(await routeLinkToVault({ artistId: "a1" }, "https://peterango.com")).toBe(
      "vaultInsertFailed",
    );
    error.mockRestore();
  });
});
