import { it, expect } from "vitest";
import { websiteDestinationLabel } from "@/lib/links/websiteDestinationLabel";

it("puts the page before the host, and shows a home page as its host", () => {
  expect(websiteDestinationLabel("https://www.peterango.com/")).toBe("peterango.com");
  expect(websiteDestinationLabel("https://peterango.com/tour?y=2026")).toBe(
    "/tour?y=2026 · peterango.com",
  );
});
