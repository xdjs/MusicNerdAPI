import { describe, it, expect } from "vitest";
import { captionBearingPosts } from "@/lib/credits/captionBearingPosts";
import { post } from "@/lib/credits/__tests__/post";

describe("captionBearingPosts", () => {
  it("never reads a caption somebody else wrote", () => {
    expect(
      captionBearingPosts([post({ isOwnPost: false, ownerUsername: "someoneelse" })]),
    ).toHaveLength(0);
  });

  it("skips a caption that is only hashtags and dot-padding, or empty", () => {
    const dump = post({
      caption: "\n.\n.\n.\n.\n#indiepop #altpop #musicdiscovery #christmassong #popmusician",
    });
    expect(captionBearingPosts([dump, post({ caption: null })])).toHaveLength(0);
  });

  it("keeps a short credit line and a real caption", () => {
    const short = post({ caption: "Shot by @moneaofthemoon", mentions: ["moneaofthemoon"] });
    expect(captionBearingPosts([short, post()])).toHaveLength(2);
  });
});
