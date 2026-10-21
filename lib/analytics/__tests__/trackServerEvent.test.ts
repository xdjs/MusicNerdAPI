import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics/server", () => ({ track }));
const { trackServerEvent } = await import("@/lib/analytics/trackServerEvent");

beforeEach(() => {
  track.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("trackServerEvent", () => {
  it("sends the event with its properties", async () => {
    await trackServerEvent("profile_edit", { action: "photo", target: null });
    expect(track).toHaveBeenCalledWith("profile_edit", { action: "photo", target: null });
  });

  it("never throws: a failed track is logged", async () => {
    track.mockRejectedValueOnce(new Error("no request context"));
    await expect(
      trackServerEvent("profile_edit", { action: "photo", target: null }),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[analytics] server track failed:",
      expect.any(Error),
    );
  });
});
