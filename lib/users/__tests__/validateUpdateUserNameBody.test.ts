import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateUpdateUserNameBody } from "@/lib/users/validateUpdateUserNameBody";

const post = (body: BodyInit | null, type = "application/json") =>
  new Request("https://x/api/user/u1", {
    method: "PATCH",
    body,
    headers: { "Content-Type": type },
  });

describe("validateUpdateUserNameBody", () => {
  it("returns the username as sent, leaving its validation to validateUserName", async () => {
    expect(await validateUpdateUserNameBody(post(JSON.stringify({ username: " Vinyl " })))).toEqual(
      {
        username: " Vinyl ",
      },
    );
    expect(await validateUpdateUserNameBody(post(JSON.stringify({ username: 42 })))).toEqual({
      username: 42,
    });
    expect(await validateUpdateUserNameBody(post(JSON.stringify({})))).toEqual({
      username: undefined,
    });
  });

  it.each([
    ["not JSON", "{nope"],
    ["an empty body", ""],
    ["a JSON string", JSON.stringify("x")],
    ["JSON null", "null"],
    ["a JSON array", "[]"],
  ])("is 400 for %s", async (_label, body) => {
    const res = await validateUpdateUserNameBody(post(body));
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    expect(await (res as NextResponse).json()).toEqual({
      status: "error",
      error: "Invalid request body",
    });
    expect((res as NextResponse).headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
