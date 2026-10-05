import { expect, it } from "vitest";
import { getFetchedSourceUrl } from "../getFetchedSourceUrl";
import { goodPage } from "@/lib/vault/__tests__/searchRun";

it("uses the safe final response URL, keeping exact opaque path IDs", () => {
  const url = "https://open.spotify.com/artist/AAAAAAAAAAAAAAAAAAAAAA";
  expect(getFetchedSourceUrl("https://example.com/listen", { ...goodPage, resolvedUrl: url })).toBe(
    url,
  );
  expect(getFetchedSourceUrl("https://example.com", goodPage)).toBe("https://example.com");
});

it.each([
  "javascript:alert(1)",
  "http://127.0.0.1/private",
  "https://user:password@example.com/",
  "https://www.viberate.com/artist/grimes",
  "https://www.linkedin.com/in/grimes",
])("rejects an unsafe, credentialed, excluded or blocked final URL: %s", resolvedUrl => {
  expect(
    getFetchedSourceUrl("https://example.com/listen", { ...goodPage, resolvedUrl }),
  ).toBeNull();
});
