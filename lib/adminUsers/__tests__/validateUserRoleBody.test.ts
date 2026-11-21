import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateUserRoleBody } from "@/lib/adminUsers/validateUserRoleBody";

const id = "0b1e4c2a-7f3d-4a58-9c61-2d8e5f7a9b10";
const request = (body: string) =>
  new Request("https://api.musicnerd.test/api/admin/users", { method: "PATCH", body });

describe("validateUserRoleBody", () => {
  it("returns the user ids, role and flag", async () => {
    expect(
      await validateUserRoleBody(
        request(JSON.stringify({ userIds: [id], role: "hidden", enabled: false })),
      ),
    ).toEqual({ userIds: [id], role: "hidden", enabled: false });
  });

  it.each([
    "not json",
    JSON.stringify({ userIds: [], role: "admin", enabled: true }),
    JSON.stringify({ userIds: ["0xabc"], role: "admin", enabled: true }),
    JSON.stringify({ userIds: [id], role: "superadmin", enabled: true }),
    JSON.stringify({ userIds: [id], role: "admin", enabled: "yes" }),
  ])("rejects %s", async body => {
    const res = await validateUserRoleBody(request(body));
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    expect(await (res as NextResponse).json()).toEqual({
      status: "error",
      error: "Invalid role change",
    });
  });
});
