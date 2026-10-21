import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateRunReportBody } from "@/lib/agentReports/validateRunReportBody";

const valid = {
  workerId: "w1",
  runNumber: 1,
  status: "running",
  startedAt: "2026-03-25T12:00:00Z",
};
const errorOf = async (body: unknown) => {
  const result = validateRunReportBody(body);
  if (!(result instanceof NextResponse)) throw new Error("expected a 400");
  return { status: result.status, ...(await result.json()) };
};

describe("validateRunReportBody", () => {
  it("returns the minimal report and a full one", () => {
    expect(validateRunReportBody(valid)).toEqual(valid);
    const full = {
      ...valid,
      status: "success",
      platform: "deezer",
      endedAt: "2026-03-25T12:05:00Z",
      wallTimeSecs: 300,
      claudeTimeSecs: 280,
      apiTimeSecs: 290,
      turns: 25,
      batchSize: 50,
      resolved: 10,
      excluded: 2,
      skipped: 3,
      errors: 0,
      highConfidence: 8,
      mediumConfidence: 2,
      conflicts: 0,
      nameMismatches: 1,
      tooAmbiguous: 1,
      exitCode: 0,
      failCategory: "timeout",
      failReason: "batch exceeded 20 minutes",
    };
    expect(validateRunReportBody(full)).toEqual(full);
  });

  it("drops optional fields of the wrong type (null included) instead of refusing them", () => {
    expect(
      validateRunReportBody({ ...valid, failCategory: null, failReason: null, turns: "25" }),
    ).toEqual(valid);
  });

  it("accepts every status MusicNerdWeb accepted", () => {
    for (const status of ["running", "success", "failed"])
      expect(validateRunReportBody({ ...valid, status })).toMatchObject({ status });
  });

  it("is 400 with Web's messages for each required field", async () => {
    expect(await errorOf({ ...valid, workerId: undefined })).toEqual({
      status: 400,
      error: "workerId is required",
    });
    expect(await errorOf({ ...valid, runNumber: undefined })).toMatchObject({
      error: "runNumber must be a positive integer",
    });
    expect(await errorOf({ ...valid, runNumber: 3.5 })).toMatchObject({
      error: "runNumber must be a positive integer",
    });
    expect(await errorOf({ ...valid, runNumber: 0 })).toMatchObject({
      error: "runNumber must be a positive integer",
    });
    expect(await errorOf({ ...valid, status: "bogus" })).toMatchObject({
      error: "status must be one of: running, success, failed",
    });
    expect(await errorOf({ ...valid, startedAt: undefined })).toMatchObject({
      error: "startedAt is required (ISO timestamp)",
    });
  });
});
