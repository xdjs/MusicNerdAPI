import { describe, it, expect, vi, beforeEach } from "vitest";
import { userLabel } from "@/lib/claims/userLabel";

const m = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock("@/lib/users/getUserById", () => ({ getUserById: m.user }));

beforeEach(() => vi.clearAllMocks());

describe("userLabel", () => {
  it("is the user's email", async () => {
    m.user.mockResolvedValueOnce({ id: "u1", email: "a@example.test" });
    expect(await userLabel("u1")).toBe("a@example.test");
  });

  it("falls back to the id without an email or when the read fails", async () => {
    m.user.mockResolvedValueOnce({ id: "u1", email: null });
    expect(await userLabel("u1")).toBe("u1");
    m.user.mockRejectedValueOnce(new Error("db down"));
    expect(await userLabel("u1")).toBe("u1");
  });
});
