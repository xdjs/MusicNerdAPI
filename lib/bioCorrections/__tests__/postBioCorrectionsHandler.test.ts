import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  validate: vi.fn(),
  execute: vi.fn(),
}));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

import { postBioCorrectionsHandler } from "@/lib/bioCorrections/postBioCorrectionsHandler";

describe("postBioCorrectionsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.validate.mockResolvedValue({ artistId: "a1", userId: "u1" });
    mock.execute.mockResolvedValue([]);
  });

  const validBody = { claim: "Incorrect birthdate", kind: "inaccurate" as const };

  it("returns 201 for a valid correction", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify(validBody),
    });
    const response = await postBioCorrectionsHandler(request, "a1");
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(mock.execute).toHaveBeenCalledOnce();
  });

  it("returns 400 for invalid body", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ bad: true }),
    });
    const response = await postBioCorrectionsHandler(request, "a1");
    expect(response.status).toBe(400);
  });

  it("returns 413 for an oversized payload", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: "x".repeat(19000),
    });
    const response = await postBioCorrectionsHandler(request, "a1");
    expect(response.status).toBe(413);
  });

  it("passes through 401 from auth", async () => {
    mock.validate.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify(validBody),
    });
    const response = await postBioCorrectionsHandler(request, "a1");
    expect(response.status).toBe(401);
  });

  it("includes CORS headers on success", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify(validBody),
    });
    const response = await postBioCorrectionsHandler(request, "a1");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
