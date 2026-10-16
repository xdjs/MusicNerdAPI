import { describe, it, expect, vi, beforeEach } from "vitest";

const { fetchLinkPreview } = vi.hoisted(() => ({ fetchLinkPreview: vi.fn() }));
vi.mock("@/lib/pages/fetchLinkPreview", () => ({ fetchLinkPreview }));
const { accountPageConfirms } = await import("@/lib/vault/accountPageConfirms");

const cand = (id: string, title: string, description = "") => ({
  siteName: "instagram",
  id,
  url: `https://www.instagram.com/${id}/?hl=en`,
  title,
  description,
});
beforeEach(() => {
  fetchLinkPreview.mockReset().mockResolvedValue({ title: null, imageUrl: null });
});

describe("accountPageConfirms", () => {
  it("rejects a fetched Topic title but not an official channel whose description mentions a topic", async () => {
    const youtube = {
      ...cand("grimes", "Grimes - Topic - YouTube"),
      siteName: "youtube",
      url: "https://youtube.com/@grimes",
    };
    expect(await accountPageConfirms(youtube, "Grimes")).toBeNull();
    expect(
      await accountPageConfirms(
        {
          ...youtube,
          title: "Grimes - YouTube",
          description: "Official channel. Today's topic: production.",
        },
        "Grimes",
      ),
    ).toContain("Official channel");
  });
  it("confirms on the title alone, however unlike the name the handle is", async () => {
    expect(
      await accountPageConfirms(
        cand("p3t3rango", "Pete Rango (@p3t3rango) • Instagram"),
        "Pete Rango",
      ),
    ).toBe("Pete Rango (@p3t3rango) • Instagram");
  });

  it("needs the handle to resemble the name when only the description names them", async () => {
    expect(
      await accountPageConfirms(
        cand("blackdave.xyz", "Black Dave!", "Making music as Black Dave MK2"),
        "Black Dave MK2",
      ),
    ).toBe("Black Dave! Making music as Black Dave MK2");
    expect(
      await accountPageConfirms(
        cand("insomniac", "Insomniac Events", "Featuring Hardwell and more"),
        "Hardwell",
      ),
    ).toBeNull();
  });

  it("rejects a page that doesn't name them, and reads a preview only when the fetch got nothing", async () => {
    expect(await accountPageConfirms(cand("someone", "Someone Else"), "Grimes")).toBeNull();
    expect(fetchLinkPreview).not.toHaveBeenCalled();
    fetchLinkPreview.mockResolvedValueOnce({ title: "Grimes (@grimes)", imageUrl: null });
    expect(await accountPageConfirms(cand("grimes", ""), "Grimes")).toBe("Grimes (@grimes)");
    expect(fetchLinkPreview).toHaveBeenCalledWith("https://www.instagram.com/grimes/");
    expect(await accountPageConfirms(cand("nobody", ""), "Grimes")).toBeNull();
  });
});
