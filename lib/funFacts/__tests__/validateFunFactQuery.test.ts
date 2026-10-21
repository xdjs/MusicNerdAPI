import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateFunFactQuery } from "@/lib/funFacts/validateFunFactQuery";

describe("validateFunFactQuery", () => {
  it("returns the artist id", () => {
    const request = new Request("https://api/api/funFacts/lore?id=a1");
    expect(validateFunFactQuery(request)).toEqual({ id: "a1" });
  });

  it.each(["", "?id="])("answers 400 when the id is missing or empty (%j)", async query => {
    const result = validateFunFactQuery(new Request(`https://api/api/funFacts/lore${query}`));
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Missing artist id" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
