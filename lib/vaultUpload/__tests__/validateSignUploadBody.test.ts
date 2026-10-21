import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateSignUploadBody } from "@/lib/vaultUpload/validateSignUploadBody";

const artistId = "11111111-1111-4111-8111-111111111111";
const request = (body: unknown) =>
  new Request("https://api.musicnerd.test/api/vault/upload/sign", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const valid = { artistId, name: "file.pdf", type: "", size: 10 * 1024 * 1024 };

describe("validateSignUploadBody", () => {
  it("accepts a file up to exactly 10 MiB with an empty declared type", async () => {
    expect(await validateSignUploadBody(request(valid))).toEqual(valid);
  });

  it.each([
    ["one byte over", { ...valid, size: valid.size + 1 }],
    ["a zero size", { ...valid, size: 0 }],
    ["a fractional size", { ...valid, size: 1.5 }],
    ["a non-UUID artist", { ...valid, artistId: "artist-x" }],
    ["a blank name", { ...valid, name: "  " }],
    ["a long name", { ...valid, name: "x".repeat(256) }],
    ["a missing type", { artistId, name: "file.pdf", size: 1 }],
    ["a malformed body", "{broken"],
    ["an array body", "[]"],
  ])("rejects %s with Web's 400 message and CORS headers", async (_label, body) => {
    const result = await validateSignUploadBody(request(body));
    expect(result).toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) return;
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({
      status: "error",
      error: "Choose a file up to 10 MB per file.",
    });
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
