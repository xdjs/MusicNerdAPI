import { describe, it, expect, vi } from "vitest";
import { urlmapRows } from "@/lib/artists/__tests__/urlmapRows";
import { matchUrlmapRow } from "@/lib/artists/matchUrlmapRow";

const row = (siteName: string) => urlmapRows.find(r => r.siteName === siteName)!;

describe("matchUrlmapRow", () => {
  it("is undefined when the row does not match or its host guard refuses", () => {
    expect(matchUrlmapRow(row("instagram"), "https://example.com/a")).toBeUndefined();
    expect(matchUrlmapRow(row("x"), "https://max.com/movie")).toBeUndefined();
  });

  it("returns the platform reading, including an explicit rejection (null)", () => {
    expect(matchUrlmapRow(row("instagram"), "https://instagram.com/pete")).toMatchObject({
      id: "pete",
    });
    expect(
      matchUrlmapRow(row("spotify"), "https://open.spotify.com/track/0TnOYISbd1XYRBk9myaseg"),
    ).toBeNull();
  });

  it("skips a malformed stored pattern", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      matchUrlmapRow({ ...row("instagram"), regex: "(" }, "https://instagram.com/pete"),
    ).toBeUndefined();
    err.mockRestore();
  });
});
