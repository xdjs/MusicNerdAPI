import { NextResponse } from "next/server";
import { describe, it, expect } from "vitest";
import { validateDeleteVaultSourcesBody } from "@/lib/vaultSources/validateDeleteVaultSourcesBody";

const id = "2c6f1c6e-4f0a-4b9b-8a6a-3b1f0b2d9e71";

describe("validateDeleteVaultSourcesBody", () => {
  it("accepts 1 to 200 source ids", () => {
    expect(validateDeleteVaultSourcesBody({ sourceIds: [id] })).toEqual({ sourceIds: [id] });
  });

  it.each([
    [null],
    [{}],
    [{ sourceIds: [] }],
    [{ sourceIds: ["nope"] }],
    [{ sourceIds: Array(201).fill(id) }],
  ])("rejects %j with a 400", async body => {
    const res = validateDeleteVaultSourcesBody(body) as NextResponse;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("sourceIds must be 1 to 200 source IDs");
  });
});
