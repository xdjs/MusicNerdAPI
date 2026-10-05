import { expect, it } from "vitest";
import { resolveDiscoveryResult } from "../resolveDiscoveryResult";
import { hit } from "./searchRun";

it.each([
  "https://soundcloud.com/show/interview",
  "https://mixcloud.com/show/interview/",
  "https://audius.co/show/interview",
])("infers audio when a redirect resolves to a mixed-use recording: %s", url => {
  expect(resolveDiscoveryResult(hit("https://example.com/redirect"), url)).toMatchObject({
    url,
    type: "audio",
  });
});

it.each(["audio", "interview"] as const)(
  "preserves explicit %s evidence through a redirect",
  type => {
    const result = { ...hit("https://example.com/interview"), type };
    expect(resolveDiscoveryResult(result, "https://soundcloud.com/show").type).toBe(type);
  },
);

it("keeps official-website intent only for noncatalog URLs", () => {
  const result = { ...hit("https://example.com/redirect"), type: "website" as const };
  expect(resolveDiscoveryResult(result, "https://artist.example/").type).toBe("website");
  expect(resolveDiscoveryResult(result, "https://music.apple.com/artist/grimes/123").type).toBe(
    "music",
  );
});
