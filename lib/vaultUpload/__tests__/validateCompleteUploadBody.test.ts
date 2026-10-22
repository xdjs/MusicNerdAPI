import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateCompleteUploadBody } from "@/lib/vaultUpload/validateCompleteUploadBody";

const request = (body: string) =>
  new Request("https://api.musicnerd.test/api/vault/upload/complete", { method: "POST", body });

describe("validateCompleteUploadBody", () => {
  it("returns the ticket string", async () => {
    expect(await validateCompleteUploadBody(request('{"ticket":"abc.def"}'))).toEqual({
      ticket: "abc.def",
    });
  });

  it.each(["{}", '{"ticket":5}', "{broken", "[]", ""])(
    "rejects %s as an invalid ticket, with CORS headers",
    async body => {
      const result = await validateCompleteUploadBody(request(body));
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
      expect(await result.json()).toEqual({
        status: "error",
        error: "Upload expired or invalid. Please try again.",
      });
      expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
    },
  );
});
