import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateUploadForm } from "@/lib/vaultUpload/validateUploadForm";

const request = (form: FormData | string) =>
  new Request("https://api.musicnerd.test/api/vault/upload", { method: "POST", body: form });

describe("validateUploadForm", () => {
  it("returns the file and artist id", async () => {
    const form = new FormData();
    form.append("file", new File(["%PDF-1.4"], "doc.pdf", { type: "application/pdf" }));
    form.append("artistId", "artist-x");
    const result = await validateUploadForm(request(form));
    expect(result).not.toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) return;
    expect(result.artistId).toBe("artist-x");
    expect(result.file.name).toBe("doc.pdf");
    expect(result.file.size).toBe(8);
  });

  it.each([
    ["no file", (f: FormData) => f.append("artistId", "artist-x")],
    ["no artist", (f: FormData) => f.append("file", new File(["x"], "a.txt"))],
    [
      "an empty artist",
      (f: FormData) => {
        f.append("file", new File(["x"], "a.txt"));
        f.append("artistId", "");
      },
    ],
    [
      "a text file field",
      (f: FormData) => {
        f.append("file", "not a file");
        f.append("artistId", "artist-x");
      },
    ],
  ])("rejects %s with Web's 400 message", async (_label, fill) => {
    const form = new FormData();
    fill(form);
    const result = await validateUploadForm(request(form));
    expect(result).toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) return;
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({
      status: "error",
      error: "File and artistId are required",
    });
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("rejects a body that is not a form", async () => {
    const result = await validateUploadForm(request("{}"));
    expect(result).toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) return;
    expect(result.status).toBe(400);
  });
});
