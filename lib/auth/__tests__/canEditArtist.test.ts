import { describe, it, expect, vi, beforeEach } from "vitest";

const { findApprovedClaim, findUser } = vi.hoisted(() => ({
  findApprovedClaim: vi.fn(),
  findUser: vi.fn(),
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim }));
vi.mock("@/lib/db/db", () => ({ db: { query: { users: { findFirst: findUser } } } }));
const { canEditArtist } = await import("@/lib/auth/canEditArtist");

beforeEach(() => {
  findApprovedClaim.mockReset();
  findUser.mockReset();
});

describe("canEditArtist", () => {
  it("lets the approved claimant edit, without reading the user", async () => {
    findApprovedClaim.mockResolvedValueOnce({ id: "c1", userId: "u1" });
    expect(await canEditArtist("u1", "a1")).toBe(true);
    expect(findUser).not.toHaveBeenCalled();
  });

  it("lets an admin edit someone else's artist", async () => {
    findApprovedClaim.mockResolvedValueOnce({ id: "c1", userId: "owner" });
    findUser.mockResolvedValueOnce({ isAdmin: true });
    expect(await canEditArtist("admin", "a1")).toBe(true);
  });

  it("refuses anyone else, including when the artist is unclaimed", async () => {
    findApprovedClaim.mockResolvedValueOnce({ id: "c1", userId: "owner" });
    findUser.mockResolvedValueOnce({ isAdmin: false });
    expect(await canEditArtist("u2", "a1")).toBe(false);
    findApprovedClaim.mockResolvedValueOnce(undefined);
    findUser.mockResolvedValueOnce(undefined);
    expect(await canEditArtist("u2", "a1")).toBe(false);
  });
});
