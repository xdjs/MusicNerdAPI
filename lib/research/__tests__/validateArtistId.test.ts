import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateArtistId } from "@/lib/research/validateArtistId";

describe("validateArtistId", () => {
  it("passes a UUID through", () => {
    expect(validateArtistId("50f23458-df64-4381-8042-7333e8b64531")).toBe(
      "50f23458-df64-4381-8042-7333e8b64531",
    );
  });

  it("is a 400 for anything else", async () => {
    const res = validateArtistId("nope") as NextResponse;
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "artistId must be a UUID" });
  });
});
