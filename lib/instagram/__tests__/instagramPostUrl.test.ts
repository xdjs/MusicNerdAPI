import { expect, it } from "vitest";
import { instagramPostUrl } from "@/lib/instagram/instagramPostUrl";
it.each([
  ["https://www.instagram.com/p/abc/", "https://www.instagram.com/p/abc/"],
  ["https://instagram.com/reel/abc", "https://instagram.com/reel/abc"],
  ["https://www.instagram.com/tv/abc/", "https://www.instagram.com/tv/abc/"],
])("accepts a post, reel or tv link: %s", (value, expected) => {
  expect(instagramPostUrl(value)).toBe(expected);
});
it.each([
  "https://instagram.com/profile/",
  "https://instagram.com.evil.test/p/x/",
  "http://www.instagram.com/p/abc/",
  "https://evil:secret@instagram.com/p/x/",
  "https://www.instagram.com/p/a/b/",
  "not a url",
  42,
  null,
])("rejects profiles, lookalike hosts, credentials, plain http and non-strings: %s", value => {
  expect(instagramPostUrl(value)).toBeNull();
});
