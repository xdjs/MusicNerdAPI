import { beforeEach, describe, expect, it, vi } from "vitest";

const { setUserName } = vi.hoisted(() => ({ setUserName: vi.fn() }));
vi.mock("@/lib/users/setUserName", () => ({ setUserName }));
const { assignUserName } = await import("@/lib/users/assignUserName");

beforeEach(() => {
  setUserName.mockReset();
});

describe("assignUserName", () => {
  it("leaves an account with a usable name alone", async () => {
    const user = { id: "u1", username: "Vinyl Otter", wallet: null };
    expect(await assignUserName(user)).toBe(user);
    expect(setUserName).not.toHaveBeenCalled();
  });

  it("gives an account without a name a generated one", async () => {
    setUserName.mockResolvedValue({ username: "Tape Moth", usernameNeedsConfirmation: true });
    const user = { id: "u1", username: null, wallet: null, isAdmin: false };
    expect(await assignUserName(user)).toEqual({
      id: "u1",
      username: "Tape Moth",
      usernameNeedsConfirmation: true,
      wallet: null,
      isAdmin: false,
    });
    expect(setUserName).toHaveBeenCalledWith("u1");
  });

  it("returns no name, never the email, when assignment fails", async () => {
    vi.spyOn(console, "warn").mockImplementationOnce(() => undefined);
    setUserName.mockRejectedValue(new Error("down"));
    const user = { id: "u1", username: "fan@example.com", wallet: null };
    expect(await assignUserName(user)).toEqual({ ...user, username: null });
  });
});
