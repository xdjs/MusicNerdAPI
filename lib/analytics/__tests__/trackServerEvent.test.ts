import { describe, it, expect, vi, beforeEach } from "vitest";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics/server", () => ({ track }));
const { trackServerEvent } = await import("@/lib/analytics/trackServerEvent");

beforeEach(() => {
  track.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("trackServerEvent", () => {
  it("sends the event with its properties", async () => {
    track.mockResolvedValue(undefined);
    await trackServerEvent("profile_edit", { action: "vault_upload", target: "application/pdf" });
    expect(track).toHaveBeenCalledWith("profile_edit", {
      action: "vault_upload",
      target: "application/pdf",
    });
  });

  it("never fails the request when tracking throws", async () => {
    track.mockRejectedValue(new Error("no request context"));
    await expect(
      trackServerEvent("profile_edit", { action: "vault_upload" }),
    ).resolves.toBeUndefined();
  });
});
