import { describe, it, expect, vi, beforeEach } from "vitest";

const { getOnboardingStepTimes } = vi.hoisted(() => ({ getOnboardingStepTimes: vi.fn() }));
vi.mock("@/lib/onboarding/getOnboardingStepTimes", () => ({ getOnboardingStepTimes }));
const { getOnboardingStateHandler } = await import("@/lib/onboarding/getOnboardingStateHandler");

const ID = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const none = { profiles: null, vault: null, interview: null, publish: null };

beforeEach(() => getOnboardingStepTimes.mockReset());

describe("getOnboardingStateHandler", () => {
  it("returns the built state: complete, no current step, every time", async () => {
    const steps = {
      profiles: "2026-10-02T23:33:42.122Z",
      vault: "2026-10-02T23:33:46.437Z",
      interview: "2026-10-02T23:33:58.667Z",
      publish: "2026-10-02T23:33:58.667Z",
    };
    getOnboardingStepTimes.mockResolvedValueOnce(steps);
    const res = await getOnboardingStateHandler(ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", complete: true, currentStep: null, steps });
  });

  it("names the first unconfirmed step mid-build", async () => {
    const steps = {
      ...none,
      profiles: "2026-10-02T23:33:42.122Z",
      vault: "2026-10-02T23:33:46.437Z",
    };
    getOnboardingStepTimes.mockResolvedValueOnce(steps);
    expect(await (await getOnboardingStateHandler(ID)).json()).toEqual({
      status: "ok",
      complete: false,
      currentStep: "interview",
      steps,
    });
  });

  it("is not started, at profiles, with every step null", async () => {
    getOnboardingStepTimes.mockResolvedValueOnce(none);
    expect(await (await getOnboardingStateHandler(ID)).json()).toEqual({
      status: "ok",
      complete: false,
      currentStep: "profiles",
      steps: none,
    });
  });

  it("is public, CORS-enabled and never cached", async () => {
    getOnboardingStepTimes.mockResolvedValueOnce(none);
    const res = await getOnboardingStateHandler(ID);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 400 for an id that isn't a UUID, without reading", async () => {
    const res = await getOnboardingStateHandler("nope");
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(getOnboardingStepTimes).not.toHaveBeenCalled();
  });

  it("returns 503 when the state can't be read, never a not-started state", async () => {
    getOnboardingStepTimes.mockResolvedValueOnce(null);
    const res = await getOnboardingStateHandler(ID);
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: "error", error: "Onboarding state unavailable" });
  });
});
