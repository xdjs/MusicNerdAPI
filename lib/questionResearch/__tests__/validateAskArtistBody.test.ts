import { expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateAskArtistBody } from "@/lib/questionResearch/validateAskArtistBody";
const artistId = "11111111-1111-4111-8111-111111111111";
const post = (body: string) =>
  new Request("https://api.example/api/askArtist", { method: "POST", body });
it("returns the parsed question request", async () => {
  const result = await validateAskArtistBody(
    post(JSON.stringify({ artistId, question: " Who played drums? " })),
  );
  expect(result).toEqual({ artistId, question: "Who played drums?" });
});
it.each([
  ["x".repeat(18001), "Question too long"],
  ["{not json", "Invalid question"],
  [JSON.stringify({ artistId: "nope", question: "q" }), "Invalid artist or question"],
  [JSON.stringify({ artistId, question: "q", userId: "u" }), "Invalid artist or question"],
])("answers 400 with Web's message, CORS and no-store: %#", async (body, message) => {
  const result = await validateAskArtistBody(post(body));
  expect(result).toBeInstanceOf(NextResponse);
  const response = result as NextResponse;
  expect(response.status).toBe(400);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(await response.json()).toEqual({ status: "error", error: message });
});
