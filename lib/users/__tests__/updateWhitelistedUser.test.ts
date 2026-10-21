import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateWhitelistedUser } from "@/lib/users/updateWhitelistedUser";

const mock = vi.hoisted(() => ({
  transaction: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  setUserName: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: mock.transaction } }));
vi.mock("@/lib/users/setUserName", () => ({ setUserName: mock.setUserName }));

const tx = { update: mock.update };

beforeEach(() => {
  vi.clearAllMocks();
  mock.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(tx));
  mock.update.mockReturnValue({ set: mock.set });
  mock.set.mockReturnValue({ where: mock.where });
  mock.where.mockResolvedValue(undefined);
});

describe("updateWhitelistedUser", () => {
  it("writes only the fields sent; null clears wallet and email", async () => {
    expect(
      await updateWhitelistedUser("u1", { wallet: null, email: "e@x.test", isHidden: true }),
    ).toEqual({
      status: "success",
      message: "User updated successfully",
    });
    expect(mock.set).toHaveBeenCalledWith({ wallet: null, email: "e@x.test", isHidden: true });
    expect(mock.setUserName).not.toHaveBeenCalled();
  });

  it("whitelists an admin and ignores isWhiteListed in the same request", async () => {
    await updateWhitelistedUser("u1", { isAdmin: true, isWhiteListed: false });
    expect(mock.set).toHaveBeenCalledWith({ isAdmin: true, isWhiteListed: true });
  });

  it("honours isWhiteListed when isAdmin is false or absent", async () => {
    await updateWhitelistedUser("u1", { isAdmin: false, isWhiteListed: true });
    expect(mock.set).toHaveBeenCalledWith({ isAdmin: false, isWhiteListed: true });
  });

  it("sets the user name through setUserName inside the transaction", async () => {
    mock.setUserName.mockResolvedValueOnce({
      username: "Vinyl Otter",
      usernameNeedsConfirmation: false,
    });
    expect(await updateWhitelistedUser("u1", { username: "Vinyl Otter" })).toEqual({
      status: "success",
      message: "User updated successfully",
    });
    expect(mock.setUserName).toHaveBeenCalledWith("u1", "Vinyl Otter", tx);
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("reports a refused user name as an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.setUserName.mockRejectedValueOnce(
      new Error("That user name is already taken. Try another."),
    );
    expect(await updateWhitelistedUser("u1", { username: "Taken", isHidden: true })).toEqual({
      status: "error",
      message: "Error updating user",
    });
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("reports nothing to update", async () => {
    expect(await updateWhitelistedUser("u1", {})).toEqual({
      status: "error",
      message: "No fields to update",
    });
  });

  it("reports a missing id or a database failure as an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await updateWhitelistedUser("", { isHidden: true })).toEqual({
      status: "error",
      message: "Error updating user",
    });
    mock.where.mockRejectedValueOnce(new Error("db down"));
    expect(await updateWhitelistedUser("u1", { isHidden: true })).toEqual({
      status: "error",
      message: "Error updating user",
    });
  });
});
