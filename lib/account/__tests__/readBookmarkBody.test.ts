import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readBookmarkBody } from "@/lib/account/readBookmarkBody";

const schema = z.object({ a: z.number() }).strict();
const request = (body: string) =>
  new Request("https://api.musicnerd.test/api/bookmarks", { method: "POST", body });

describe("readBookmarkBody", () => {
  it("returns the parsed body", async () => {
    expect(await readBookmarkBody(request('{"a":1}'), schema)).toEqual({ a: 1 });
  });

  it("names malformed JSON", async () => {
    const res = await readBookmarkBody(request("{"), schema);
    expect(res).toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) return;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid JSON body" });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejects a body the schema refuses", async () => {
    const res = await readBookmarkBody(request('{"a":1,"b":2}'), schema);
    expect(res).toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) return;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid bookmark request" });
  });
});
