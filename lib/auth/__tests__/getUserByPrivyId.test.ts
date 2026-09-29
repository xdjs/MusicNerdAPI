import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { query: { users: { findFirst } } } }));
const { getUserByPrivyId } = await import("@/lib/auth/getUserByPrivyId");

beforeEach(() => findFirst.mockReset());

describe("getUserByPrivyId", () => {
  it("returns the Music Nerd user for a Privy id", async () => {
    findFirst.mockResolvedValueOnce({ id: "u1", isAdmin: false });
    expect(await getUserByPrivyId("did:privy:abc")).toEqual({ id: "u1", isAdmin: false });
  });

  it("is undefined when nobody has signed in with that Privy account", async () => {
    findFirst.mockResolvedValueOnce(undefined);
    expect(await getUserByPrivyId("did:privy:new")).toBeUndefined();
  });
});
