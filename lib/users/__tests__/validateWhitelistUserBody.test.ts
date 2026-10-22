import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateWhitelistUserBody } from "@/lib/users/validateWhitelistUserBody";

const request = (body?: string) =>
  new Request("https://api.musicnerd.test/api/admin/whitelist-user/u1", {
    method: "PUT",
    ...(body === undefined ? {} : { body }),
  });

describe("validateWhitelistUserBody", () => {
  it("returns the fields sent, with null allowed for wallet and email", async () => {
    expect(
      await validateWhitelistUserBody(
        request(
          '{"wallet":null,"email":"e@x.test","username":"Vinyl Otter","isAdmin":true,"extra":1}',
        ),
      ),
    ).toEqual({ wallet: null, email: "e@x.test", username: "Vinyl Otter", isAdmin: true });
  });

  it("accepts an empty object; the update decides there is nothing to do", async () => {
    expect(await validateWhitelistUserBody(request("{}"))).toEqual({});
  });

  it.each(['{"isAdmin":"yes"}', '{"username":null}', '{"wallet":5}', "[]", "{broken", ""])(
    "rejects a wrong-typed field with a CORS-enabled 400: %s",
    async body => {
      const result = await validateWhitelistUserBody(request(body));
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
      expect(await result.json()).toEqual({
        status: "error",
        error: "Invalid whitelist user body",
      });
      expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
    },
  );
});
