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

it.each([
  "https://www.google.com/sorry/index?continue=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3Dfixture",
  "https://accounts.google.com/ServiceLogin",
  "https://consent.youtube.com/m?continue=https://youtube.com/watch?v=fixture",
  "https://consent.google.com/m",
  "https://artist.example/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1",
  "https://artist.example/login?next=/interview",
  "https://artist.example/sign-in/",
  "https://artist.example/captcha/verify",
  "https://artist.example/challenge",
])("rejects an access gate before original search evidence can be reused: %s", resolvedUrl => {
  expect(
    getFetchedSourceUrl("https://www.youtube.com/watch?v=fixture", { ...goodPage, resolvedUrl }),
  ).toBeNull();
  expect(getFetchedSourceUrl(resolvedUrl, goodPage)).toBeNull();
});

it.each([
  "https://magazine.example/articles/login-and-captcha-in-music",
  "https://artist.example/album/challenge",
  "https://artist.example/interview?next=/login",
  "https://www.google.com/search?q=artist",
])("preserves legitimate destinations without keyword blocking: %s", resolvedUrl => {
  expect(getFetchedSourceUrl("https://example.com/redirect", { ...goodPage, resolvedUrl })).toBe(
    resolvedUrl,
  );
});
