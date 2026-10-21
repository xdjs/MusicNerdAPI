import { it, expect } from "vitest";
import { isMainWebsiteSource } from "@/lib/links/isMainWebsiteSource";

const site = (url: string, extra = {}) => ({ url, type: "website", ...extra });

it("a website is main unless another approved website source contains it", () => {
  const main = site("https://peterango.com/");
  expect(isMainWebsiteSource(main, [main])).toBe(true);
  expect(isMainWebsiteSource(site("https://peterango.com/tour"), [main])).toBe(false);
  expect(isMainWebsiteSource(site("https://peterango.com/?s=1"), [main])).toBe(false);
  expect(
    isMainWebsiteSource(site("https://peterango.com/tour"), [{ ...main, status: "pending" }]),
  ).toBe(true);
  expect(isMainWebsiteSource({ url: "https://peterango.com/", type: "article" })).toBe(false);
});
