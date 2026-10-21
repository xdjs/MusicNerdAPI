import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateReportId } from "@/lib/bioCorrections/validateReportId";

describe("validateReportId", () => {
  it("accepts a UUID in either case", () => {
    expect(validateReportId("e7a5f235-4e66-40ba-9ff6-7276339fe34f")).toBe(
      "e7a5f235-4e66-40ba-9ff6-7276339fe34f",
    );
    expect(validateReportId("E7A5F235-4E66-40BA-9FF6-7276339FE34F")).toBe(
      "E7A5F235-4E66-40BA-9FF6-7276339FE34F",
    );
  });

  it("rejects anything else with MusicNerdWeb's 400", async () => {
    const result = validateReportId("report-1");
    expect(result).toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) return;
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({ status: "error", error: "Invalid report ID" });
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
