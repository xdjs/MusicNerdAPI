import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateProfileImageForm } from "@/lib/artistImages/validateProfileImageForm";

const ARTIST = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const form = (fields: Record<string, string | File>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return new Request("https://api.test/api/artist/profile-image", { method: "POST", body: data });
};
const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "me.png", { type: "image/png" });

describe("validateProfileImageForm", () => {
  it("returns the file and artist id", async () => {
    const result = await validateProfileImageForm(form({ file: png, artistId: ARTIST }));
    expect(result).not.toBeInstanceOf(NextResponse);
    const { file, artistId } = result as { file: File; artistId: string };
    expect(artistId).toBe(ARTIST);
    expect(file.name).toBe("me.png");
    expect(file.type).toBe("image/png");
  });

  it("answers 400 'File and artistId are required' when either is missing, or the body isn't a form", async () => {
    const requests = [
      form({ artistId: ARTIST }),
      form({ file: png }),
      form({ file: "not a file", artistId: ARTIST }),
      new Request("https://api.test/api/artist/profile-image", { method: "POST", body: "{}" }),
    ];
    for (const request of requests) {
      const result = await validateProfileImageForm(request);
      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        status: "error",
        error: "File and artistId are required",
      });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    }
  });

  it("answers 400 'Invalid artist' when the id isn't a UUID, since it names the stored object", async () => {
    const result = await validateProfileImageForm(form({ file: png, artistId: "../etc" }));
    const response = result as NextResponse;
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: "error", error: "Invalid artist" });
  });
});
