import { describe, expect, it } from "vitest";
import { validateArtistImageId } from "@/lib/artistImage/validateArtistImageId";

describe("validateArtistImageId", () => {
  it("returns a UUID, in either case", () => {
    expect(validateArtistImageId("6CB3D81A-0000-4000-8000-000000000000")).toBe(
      "6CB3D81A-0000-4000-8000-000000000000",
    );
  });

  it("answers an empty, uncached 400 for anything else", async () => {
    const res = validateArtistImageId("not-a-uuid") as Response;
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.text()).toBe("");
  });
});
