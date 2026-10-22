import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateBioCorrectionReviewBody } from "@/lib/bioCorrections/validateBioCorrectionReviewBody";

const request = (body?: string) =>
  new Request("https://api.musicnerd.test/api/admin/bio-corrections/r1", {
    method: "PATCH",
    ...(body === undefined ? {} : { body }),
  });

describe("validateBioCorrectionReviewBody", () => {
  it.each(["resolved", "dismissed"])("accepts %s", async status => {
    expect(await validateBioCorrectionReviewBody(request(`{"status":"${status}"}`))).toEqual({
      status,
    });
  });

  it.each(['{"status":"approved"}', '{"status":"pending"}', "{}", "{broken", ""])(
    "rejects anything else with MusicNerdWeb's 400: %s",
    async body => {
      const result = await validateBioCorrectionReviewBody(request(body));
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
      expect(await result.json()).toEqual({ status: "error", error: "Invalid review status" });
      expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
    },
  );
});
