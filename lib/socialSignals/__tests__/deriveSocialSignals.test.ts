import { describe, it, expect } from "vitest";
import { deriveSocialSignals } from "@/lib/socialSignals/deriveSocialSignals";
import { post } from "@/lib/socialSignals/__tests__/post";

const HANDLE = "p3t3rango";

describe("deriveSocialSignals", () => {
  it("returns all-empty signals for an empty post list", () => {
    expect(deriveSocialSignals([], HANDLE)).toEqual({
      collaborators: [],
      themes: [],
      standoutPosts: [],
      musicReferences: [],
    });
  });

  it("drops the artist's own handle from collaborators and keeps the owner and coauthor", () => {
    const signals = deriveSocialSignals(
      [
        post({
          ownerUsername: "soft_core.music",
          isOwnPost: false,
          url: "https://www.instagram.com/p/dirtyrow/",
          coauthors: ["p3t3rango", "dear_rod"],
        }),
      ],
      HANDLE,
    );
    const handles = signals.collaborators.map(c => c.handle);
    expect(handles).toEqual(expect.arrayContaining(["dear_rod", "soft_core.music"]));
    expect(handles).not.toContain(HANDLE);
  });

  it("derives from the recent window and the artist's name", () => {
    const signals = deriveSocialSignals(
      [
        post({
          url: "a",
          caption: "Back in Colombia",
          musicTitle: "Mine",
          musicArtist: "Pete Rango",
        }),
        post({
          url: "b",
          caption: "Colombia again",
          musicTitle: "Theirs",
          musicArtist: "Brian Eno",
        }),
      ],
      HANDLE,
      "Pete Rango",
    );
    expect(signals.themes.map(t => t.term)).toContain("colombia");
    expect(signals.musicReferences.map(m => m.title)).toEqual(["Mine"]);
  });
});
