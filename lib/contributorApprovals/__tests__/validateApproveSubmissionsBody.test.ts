import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateApproveSubmissionsBody } from "@/lib/contributorApprovals/validateApproveSubmissionsBody";

const id = "0b1e4c2a-7f3d-4a58-9c61-2d8e5f7a9b10";
const request = (body: string) =>
  new Request("https://api.musicnerd.test/x", { method: "POST", body });

describe("validateApproveSubmissionsBody", () => {
  it("returns up to 10 submissions", async () => {
    const items = Array.from({ length: 10 }, () => ({ id, type: "lore" }));
    expect(await validateApproveSubmissionsBody(request(JSON.stringify({ items })))).toEqual({
      items,
    });
  });

  it.each([
    "nope",
    JSON.stringify({ items: [] }),
    JSON.stringify({ items: Array.from({ length: 11 }, () => ({ id, type: "link" })) }),
    JSON.stringify({ items: [{ id: "x", type: "link" }] }),
    JSON.stringify({ items: [{ id, type: "bio" }] }),
  ])("rejects %s", async body => {
    const res = (await validateApproveSubmissionsBody(request(body))) as NextResponse;
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid approval selection" });
  });
});
