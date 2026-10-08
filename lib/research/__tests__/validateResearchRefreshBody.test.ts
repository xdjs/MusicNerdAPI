import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateResearchRefreshBody } from "@/lib/research/validateResearchRefreshBody";

const request = (body?: string) =>
  new Request("https://api.musicnerd.test/api/artist/a/research/refresh", {
    method: "POST",
    ...(body === undefined ? {} : { body }),
  });

describe("validateResearchRefreshBody", () => {
  it("keeps empty and ordinary object bodies on the existing full refresh", async () => {
    expect(await validateResearchRefreshBody(request())).toBeNull();
    expect(await validateResearchRefreshBody(request("{}"))).toBeNull();
  });

  it("accepts only the explicit stored-source mode", async () => {
    expect(await validateResearchRefreshBody(request('{"mode":"lore-only"}'))).toEqual({
      mode: "lore-only",
    });
  });

  it.each(['{"mode":"full"}', '{"mode":null}', "{broken", "[]"])(
    "rejects invalid bodies with a CORS-enabled 400: %s",
    async body => {
      const result = await validateResearchRefreshBody(request(body));
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
      expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
    },
  );
});
