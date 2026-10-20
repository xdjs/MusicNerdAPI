import { describe, it, expect, vi, beforeEach } from "vitest";

const { authenticateRequest, dbQuery, clearArtistLink } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  dbQuery: { users: { findFirst: vi.fn() } },
  clearArtistLink: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest }));
vi.mock("@/lib/db/db", () => ({ db: { query: dbQuery } }));
vi.mock("@/lib/db/schema", () => ({ users: { id: "id", isAdmin: "is_admin" } }));
vi.mock("@/lib/artistLinks/clearArtistLink", () => ({ clearArtistLink }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

const { postRemoveArtistDataHandler } =
  await import("@/lib/removeArtistData/postRemoveArtistDataHandler");

const artistId = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  authenticateRequest.mockReset().mockResolvedValue({ userId: "u1" });
  dbQuery.users.findFirst.mockReset().mockResolvedValue({ isAdmin: true });
  clearArtistLink.mockReset().mockResolvedValue({ oldValue: "old" });
});

describe("postRemoveArtistDataHandler", () => {
  it("returns 200 for admin removing a link", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ artistId, siteName: "instagram" }),
    });
    const response = await postRemoveArtistDataHandler(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
    expect(clearArtistLink).toHaveBeenCalledWith(artistId, "instagram");
  });

  it("returns 403 for non-admin", async () => {
    dbQuery.users.findFirst.mockResolvedValueOnce({ isAdmin: false });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ artistId, siteName: "instagram" }),
    });
    const response = await postRemoveArtistDataHandler(request);
    expect(response.status).toBe(403);
  });

  it("returns 400 for missing fields", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ artistId }),
    });
    const response = await postRemoveArtistDataHandler(request);
    expect(response.status).toBe(400);
  });
});
