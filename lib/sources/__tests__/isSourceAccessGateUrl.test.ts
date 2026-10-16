import { expect, it } from "vitest";
import { isSourceAccessGateUrl } from "../isSourceAccessGateUrl";

it.each([
  "not a URL",
  "https://example.com/%ZZ",
  "https://www.google.com./SORRY/index",
  "https://example.com/%6cogin",
  "https://example.com/cdn-cgi/l/chk_captcha",
])("rejects malformed or encoded access destinations: %s", url => {
  expect(isSourceAccessGateUrl(url)).toBe(true);
});

it.each([
  "https://example.com/login-song",
  "https://example.com/interviews/challenge",
  "https://example.com/?q=captcha",
  "https://google.com.example/sorry/index",
])("does not overmatch article paths or host suffixes: %s", url => {
  expect(isSourceAccessGateUrl(url)).toBe(false);
});
