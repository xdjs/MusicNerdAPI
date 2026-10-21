import { describe, it, expect, vi, beforeEach } from "vitest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";

const mock = vi.hoisted(() => ({
  getArtistById: vi.fn(),
  generateArtistBio: vi.fn(),
  persistArtistBio: vi.fn(),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: mock.getArtistById }));
vi.mock("@/lib/bio/generateArtistBio", () => ({ generateArtistBio: mock.generateArtistBio }));
vi.mock("@/lib/bio/persistArtistBio", () => ({ persistArtistBio: mock.persistArtistBio }));
const { updateArtistBio } = await import("@/lib/bio/updateArtistBio");

const auth = { userId: "u1", expectedClaimId: "c1" };

beforeEach(() => {
  vi.clearAllMocks();
  mock.getArtistById.mockResolvedValue({ bio: "Old About" });
});

describe("updateArtistBio", () => {
  it("saves the written bio through the fenced writer", async () => {
    expect(await updateArtistBio("a1", { bio: "New", regenerate: false }, auth)).toEqual({
      status: "success",
      message: "Bio updated",
    });
    expect(mock.persistArtistBio).toHaveBeenCalledWith("a1", "New", { ownership: auth });
  });

  it("reports a refused write with its message", async () => {
    mock.persistArtistBio.mockRejectedValue(
      new Error("Unpin your bio before editing it. Your saved version will be kept."),
    );
    expect(await updateArtistBio("a1", { bio: "New", regenerate: false }, auth)).toEqual({
      status: "error",
      message: "Unpin your bio before editing it. Your saved version will be kept.",
    });
  });

  it("returns a regenerated About", async () => {
    mock.generateArtistBio.mockResolvedValue({ httpStatus: 200, bio: "Fresh About" });
    expect(await updateArtistBio("a1", { regenerate: true }, auth)).toEqual({
      status: "success",
      message: "Bio regenerated",
      data: "Fresh About",
    });
    expect(mock.generateArtistBio).toHaveBeenCalledWith("a1", auth);
    expect(mock.persistArtistBio).not.toHaveBeenCalled();
  });

  it("says when the About did not change, and when it is the claim prompt", async () => {
    mock.generateArtistBio.mockResolvedValue({ httpStatus: 200, bio: "Old About", pinned: true });
    expect(await updateArtistBio("a1", { regenerate: true }, auth)).toMatchObject({
      status: "success",
      message: expect.stringContaining("About unchanged."),
      data: "Old About",
    });
    mock.generateArtistBio.mockResolvedValue({ httpStatus: 200, bio: ABOUT_EMPTY_STATE });
    expect(await updateArtistBio("a1", { regenerate: true }, auth)).toMatchObject({
      message: "No verified sources found — showing the claim prompt",
    });
  });

  it("carries a generation failure's status and code", async () => {
    mock.generateArtistBio.mockResolvedValue({
      httpStatus: 409,
      code: "LORE_REQUIRED",
      error: "Build your Lore document first.",
    });
    expect(await updateArtistBio("a1", { regenerate: true }, auth)).toEqual({
      status: "error",
      message: "Build your Lore document first.",
      statusCode: 409,
      code: "LORE_REQUIRED",
    });
    mock.generateArtistBio.mockResolvedValue({ httpStatus: 200, bio: null });
    expect(await updateArtistBio("a1", { regenerate: true }, auth)).toEqual({
      status: "error",
      message: "Failed to generate bio",
    });
  });
});
