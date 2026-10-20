import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateCorrectionAboutBody } from "@/lib/bioCorrections/validateCorrectionAboutBody";

const revision = "a".repeat(64);
const req = (body: unknown) =>
  new Request("https://x", { method: "PUT", body: JSON.stringify(body) });

describe("validateCorrectionAboutBody", () => {
  it("returns the trimmed bio and revision", async () => {
    expect(await validateCorrectionAboutBody(req({ bio: " New. ", revision }))).toEqual({
      bio: "New.",
      revision,
    });
  });

  it.each([
    [{ bio: "  ", revision }],
    [{ bio: "x".repeat(10_001), revision }],
    [{ bio: "New." }],
    [{ bio: "New.", revision: "short" }],
  ])("is a 400 for %#", async body => {
    const res = (await validateCorrectionAboutBody(req(body))) as NextResponse;
    expect(res.status).toBe(400);
  });
});
