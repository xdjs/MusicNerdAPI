import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), exec: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: m.auth,
}));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.exec } }));
const { getArtistSummariesHandler } = await import(
  "@/lib/profile/getArtistSummariesHandler"
);

const UUID = "00000000-0000-0000-0000-000000000001";
const req = (ids: string[] = [UUID]) =>
  new Request(
    `https://api/api/profile/artist-summaries?${ids.map((id) => "id=" + id).join("&")}`,
  );
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
});

describe("getArtistSummariesHandler", () => {
  it("returns 401 when not authenticated", async () => {
    m.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );
    const res = await getArtistSummariesHandler(req());
    expect(res.status).toBe(401);
  });

  it("returns 400 with no IDs", async () => {
    const res = await getArtistSummariesHandler(
      new Request("https://api/api/profile/artist-summaries"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid UUID", async () => {
    const res = await getArtistSummariesHandler(req(["not-a-uuid"]));
    expect(res.status).toBe(400);
  });

  it("returns bios for valid IDs", async () => {
    m.exec.mockResolvedValueOnce([
      { id: UUID, bio: "A real bio about this artist." },
    ]);
    const res = await getArtistSummariesHandler(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});
