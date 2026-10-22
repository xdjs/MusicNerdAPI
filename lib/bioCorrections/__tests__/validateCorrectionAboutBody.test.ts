import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateCorrectionAboutBody } from "@/lib/bioCorrections/validateCorrectionAboutBody";

const revision = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
const request = (body?: string) =>
  new Request("https://api.musicnerd.test/api/admin/bio-corrections/r1/about", {
    method: "PUT",
    ...(body === undefined ? {} : { body }),
  });

describe("validateCorrectionAboutBody", () => {
  it("returns the trimmed About and the revision", async () => {
    expect(
      await validateCorrectionAboutBody(request(JSON.stringify({ bio: "  New bio ", revision }))),
    ).toEqual({ bio: "New bio", revision });
  });

  it.each([
    ["a blank bio", { bio: "   ", revision }],
    ["a missing bio", { revision }],
    ["a bio over 10,000 characters", { bio: "x".repeat(10_001), revision }],
    ["a non-hex revision", { bio: "ok", revision: "nope" }],
    ["a short revision", { bio: "ok", revision: revision.slice(1) }],
    ["an uppercase revision", { bio: "ok", revision: revision.toUpperCase() }],
  ])("rejects %s with MusicNerdWeb's 400", async (_, body) => {
    const result = await validateCorrectionAboutBody(request(JSON.stringify(body)));
    expect(result).toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) return;
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({
      status: "error",
      error: "Enter a valid About and reload the editor if needed.",
    });
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("rejects a body that is not JSON", async () => {
    expect(await validateCorrectionAboutBody(request("{broken"))).toBeInstanceOf(NextResponse);
  });
});
