import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateReportId } from "@/lib/bioCorrections/validateReportId";

describe("validateReportId", () => {
  it("accepts a UUID", () => {
    expect(validateReportId("00000000-0000-0000-0000-000000000001")).toBe(
      "00000000-0000-0000-0000-000000000001",
    );
  });

  it("is a 400 otherwise", async () => {
    const res = validateReportId("nope") as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid report ID" });
  });
});
