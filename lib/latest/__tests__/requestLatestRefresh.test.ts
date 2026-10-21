import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ ownership: vi.fn(), draft: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/ownership/getArtistOperationOwnership", () => ({
  getArtistOperationOwnership: m.ownership,
}));
vi.mock("@/lib/latest/draftLatestRefresh", () => ({ draftLatestRefresh: m.draft }));
vi.mock("@/lib/latest/saveLatestRefresh", () => ({ saveLatestRefresh: m.save }));
const { requestLatestRefresh } = await import("@/lib/latest/requestLatestRefresh");

const context = { artistId: "a1", userId: "u1", expectedClaimId: "c1" };
const state = { claimId: "c1", userId: "u1", sources: {} };

beforeEach(() => {
  m.ownership.mockReset().mockReturnValue(context);
  m.draft.mockReset().mockResolvedValue(state);
  m.save.mockReset().mockResolvedValue("job-1");
});

describe("requestLatestRefresh", () => {
  it("needs a requester from the running operation", async () => {
    m.ownership.mockReturnValue(undefined);
    await expect(requestLatestRefresh("a1")).rejects.toThrow("Missing Latest requester");
    m.ownership.mockReturnValue({ ...context, userId: undefined });
    await expect(requestLatestRefresh("a1")).rejects.toThrow("Missing Latest requester");
    expect(m.draft).not.toHaveBeenCalled();
  });

  it("returns the existing request without saving", async () => {
    m.draft.mockResolvedValueOnce("job-0");
    expect(await requestLatestRefresh("a1")).toBe("job-0");
    expect(m.save).not.toHaveBeenCalled();
  });

  it("drafts under the operation's ownership and saves the queued job", async () => {
    expect(await requestLatestRefresh("a1")).toBe("job-1");
    expect(m.draft).toHaveBeenCalledWith("a1", context);
    expect(m.save).toHaveBeenCalledWith("a1", state);
  });

  it("checks the current connections once more when they changed during the checks", async () => {
    m.save.mockResolvedValueOnce(null).mockResolvedValueOnce("job-2");
    expect(await requestLatestRefresh("a1")).toBe("job-2");
    expect(m.draft).toHaveBeenCalledTimes(2);
  });

  it("gives up after the second change", async () => {
    m.save.mockResolvedValue(null);
    await expect(requestLatestRefresh("a1")).rejects.toThrow(
      "Connections changed while Latest was checking",
    );
    expect(m.draft).toHaveBeenCalledTimes(2);
  });
});
