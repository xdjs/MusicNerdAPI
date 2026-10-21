import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateHeartbeatBody } from "@/lib/agentReports/validateHeartbeatBody";

const errorOf = async (body: unknown) => {
  const result = validateHeartbeatBody(body);
  if (!(result instanceof NextResponse)) throw new Error("expected a 400");
  return { status: result.status, ...(await result.json()) };
};

describe("validateHeartbeatBody", () => {
  it("returns the heartbeat with its optional fields", () => {
    expect(
      validateHeartbeatBody({
        workerId: "w1",
        status: "running",
        currentRun: 5,
        batchPlatform: "deezer",
        batchSize: 50,
        message: "Run 5 starting",
        config: { batchTimeout: 1200 },
      }),
    ).toEqual({
      workerId: "w1",
      status: "running",
      currentRun: 5,
      batchPlatform: "deezer",
      batchSize: 50,
      message: "Run 5 starting",
      config: { batchTimeout: 1200 },
    });
  });

  it("drops optional fields of the wrong type instead of refusing them", () => {
    expect(
      validateHeartbeatBody({
        workerId: "w1",
        status: "idle",
        currentRun: "not-a-number",
        batchSize: "also-not",
        message: 123,
        config: "not-object",
      }),
    ).toEqual({ workerId: "w1", status: "idle" });
  });

  it("accepts every status MusicNerdWeb accepted", () => {
    for (const status of ["starting", "running", "idle", "error", "stopping"])
      expect(validateHeartbeatBody({ workerId: "w1", status })).toMatchObject({ status });
  });

  it("is 400 with Web's messages for a missing workerId or an unknown status", async () => {
    expect(await errorOf({ status: "running" })).toEqual({
      status: 400,
      error: "workerId is required",
    });
    expect(await errorOf({ workerId: "", status: "running" })).toEqual({
      status: 400,
      error: "workerId is required",
    });
    expect(await errorOf({ workerId: "w1", status: "bogus" })).toEqual({
      status: 400,
      error: "status must be one of: starting, running, idle, error, stopping",
    });
    expect(await errorOf({ status: "bogus" })).toMatchObject({ error: "workerId is required" });
    expect(await errorOf({ workerId: "w1" })).toMatchObject({
      error: "status must be one of: starting, running, idle, error, stopping",
    });
  });
});
