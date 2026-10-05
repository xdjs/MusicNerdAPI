import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateOnboardingStateParams } from "@/lib/onboarding/validateOnboardingStateParams";

describe("validateOnboardingStateParams", () => {
  it("returns the artist id when it is a UUID", () => {
    expect(validateOnboardingStateParams("aab92f80-f9e1-4299-aa33-7dd85c8de5d3")).toBe(
      "aab92f80-f9e1-4299-aa33-7dd85c8de5d3",
    );
  });

  it("returns a 400 with CORS headers for anything else", async () => {
    const response = validateOnboardingStateParams("not-a-uuid");
    expect(response).toBeInstanceOf(NextResponse);
    const res = response as NextResponse;
    expect(res.status).toBe(400);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({ status: "error", error: "Invalid artist id" });
  });
});
