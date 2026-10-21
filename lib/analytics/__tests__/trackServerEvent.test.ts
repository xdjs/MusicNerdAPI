import { describe, it, expect, vi, beforeEach } from "vitest";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics/server", () => ({ track }));
const { trackServerEvent } = await import("@/lib/analytics/trackServerEvent");

beforeEach(() => vi.clearAllMocks());

describe("trackServerEvent", () => {
  it("sends the event to Vercel Web Analytics", async () => {
    track.mockResolvedValue(undefined);
    await trackServerEvent("profile_edit", { action: "reorder", target: "links" });
    expect(track).toHaveBeenCalledWith("profile_edit", { action: "reorder", target: "links" });
  });

  it("never fails the request", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    track.mockRejectedValue(new Error("no context"));
    await expect(
      trackServerEvent("profile_edit", { action: "link_add", target: "x" }),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
