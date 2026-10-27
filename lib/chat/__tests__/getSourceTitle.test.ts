import { expect, it } from "vitest";
import { getSourceTitle } from "@/lib/chat/getSourceTitle";

it("names a stored source by its host, without www", () => {
  expect(getSourceTitle("https://www.pitchfork.com/reviews/x")).toBe("pitchfork.com");
  expect(getSourceTitle("https://open.spotify.com/artist/1")).toBe("open.spotify.com");
});
