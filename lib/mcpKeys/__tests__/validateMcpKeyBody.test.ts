import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateMcpKeyBody } from "@/lib/mcpKeys/validateMcpKeyBody";

const request = (body?: string) =>
  new Request("https://api.musicnerd.test/api/admin/mcp-keys", {
    method: "POST",
    ...(body === undefined ? {} : { body }),
  });

describe("validateMcpKeyBody", () => {
  it("returns the trimmed label", async () => {
    expect(await validateMcpKeyBody(request('{"label":"  mapping-worker "}'))).toEqual({
      label: "mapping-worker",
    });
  });

  it.each(["{}", '{"label":""}', '{"label":"   "}', '{"label":5}', "{broken", ""])(
    "rejects a missing or blank label with MusicNerdWeb's message: %s",
    async body => {
      const result = await validateMcpKeyBody(request(body));
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
      expect(await result.json()).toEqual({ status: "error", error: "Label is required" });
      expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
    },
  );
});
