import { describe, it, expect } from "vitest";
import { socialSignalSources } from "@/lib/lore/socialSignalSources";
import { post } from "@/lib/socialSignals/__tests__/post";

describe("socialSignalSources", () => {
  it("cites confirmed collaborators and the artist's own track credits by their first post", () => {
    const posts = [
      post({
        url: "https://instagram.com/p/collab",
        coauthors: ["dameatlas"],
        musicTitle: "Song Title",
        musicArtist: "Nova Reyes, Dame Atlas",
      }),
      post({
        url: "https://instagram.com/p/bg",
        musicTitle: "Las Empanadas",
        musicArtist: "Los Caracuchos",
      }),
    ];
    expect(socialSignalSources(posts, "novareyes", "Nova Reyes")).toEqual({
      socialCollaborators: [{ handle: "dameatlas", url: "https://instagram.com/p/collab" }],
      socialMusicRefs: [
        {
          title: "Song Title",
          artist: "Nova Reyes, Dame Atlas",
          url: "https://instagram.com/p/collab",
        },
      ],
    });
  });

  it("caps collaborators at four and track credits at eight", () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      post({ url: `u${i}`, coauthors: [`c${i}`], musicTitle: `T${i}`, musicArtist: "Nova Reyes" }),
    );
    const { socialCollaborators, socialMusicRefs } = socialSignalSources(
      posts,
      "novareyes",
      "Nova Reyes",
    );
    expect(socialCollaborators).toHaveLength(4);
    expect(socialMusicRefs).toHaveLength(8);
  });

  it("is empty with no posts", () => {
    expect(socialSignalSources([], "x", "X")).toEqual({
      socialCollaborators: [],
      socialMusicRefs: [],
    });
  });
});
