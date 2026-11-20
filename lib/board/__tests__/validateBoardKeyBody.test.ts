import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateBoardKeyBody } from "@/lib/board/validateBoardKeyBody";

const request = (body: string) =>
  new Request("https://api.musicnerd.test/api/board/keys", { method: "POST", body });

describe("validateBoardKeyBody", () => {
  it("returns the cleaned agent name", async () => {
    expect(await validateBoardKeyBody(request('{"agent":"Claude Duet"}'))).toEqual({
      agent: "claude-duet",
    });
  });

  it.each(['{"agent":"!!"}', "{}", "not json"])("is 400 for %s", async body => {
    const res = (await validateBoardKeyBody(request(body))) as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Agent name is required" });
  });
});
