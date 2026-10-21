import { it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateArtistBioBody } from "@/lib/bio/validateArtistBioBody";

it("accepts a bio, or regenerate without one", () => {
  expect(validateArtistBioBody({ bio: "Written" })).toEqual({ bio: "Written", regenerate: false });
  expect(validateArtistBioBody({ regenerate: true })).toEqual({ regenerate: true });
  expect(validateArtistBioBody({ regenerate: true, bio: "" })).toEqual({ regenerate: true });
});

it.each([
  [null, "Invalid bio"],
  [{}, "Invalid bio"],
  [{ bio: "   " }, "Invalid bio"],
  [{ bio: 5 }, "Invalid bio"],
  [{ bio: "x", regenerate: false }, null],
  [{ bio: "x".repeat(10_001) }, "Bio must be 10000 characters or fewer"],
  [{ bio: " ".repeat(10_001) }, "Invalid bio"],
])("validates %j", async (body, error) => {
  const result = validateArtistBioBody(body);
  if (error === null) return expect(result).toEqual({ bio: "x", regenerate: false });
  expect(result).toBeInstanceOf(NextResponse);
  const response = result as NextResponse;
  expect(response.status).toBe(400);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(await response.json()).toEqual({ status: "error", error });
});
