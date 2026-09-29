import { describe, it, expect, vi } from "vitest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
import { saveBioVersions } from "@/lib/bio/saveBioVersions";

function tx() {
  const values = vi.fn().mockResolvedValue(undefined);
  return {
    values,
    tx: {
      query: {
        artistBioVersions: {
          findFirst: vi.fn(async () => undefined as unknown),
        },
      },
      insert: vi.fn(() => ({ values })),
    },
  };
}

describe("saveBioVersions", () => {
  it("keeps both sides of an edit, oldest first", async () => {
    const { tx: t, values } = tx();
    await saveBioVersions(t as never, "a1", ["Old bio", "New bio"]);
    expect(values).toHaveBeenNthCalledWith(1, {
      artistId: "a1",
      bioText: "Old bio",
      isPinned: false,
    });
    expect(values).toHaveBeenNthCalledWith(2, {
      artistId: "a1",
      bioText: "New bio",
      isPinned: false,
    });
  });

  it("skips a text already in history, and anything that isn't a real bio", async () => {
    const { tx: t, values } = tx();
    t.query.artistBioVersions.findFirst.mockResolvedValueOnce({ id: "v1" });
    await saveBioVersions(t as never, "a1", [
      "Saved before",
      null,
      "   ",
      ABOUT_EMPTY_STATE,
      "Fresh",
    ]);
    expect(values).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith({ artistId: "a1", bioText: "Fresh", isPinned: false });
  });
});
