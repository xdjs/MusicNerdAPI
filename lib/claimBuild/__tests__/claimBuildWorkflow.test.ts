import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  step: vi.fn(),
  profiles: vi.fn(),
  sources: vi.fn(),
  about: vi.fn(),
  createHook: vi.fn(),
  conflict: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock("workflow", () => ({ createHook: m.createHook }));
vi.mock("@/lib/claimBuild/readClaimBuildStep", () => ({ readClaimBuildStep: m.step }));
vi.mock("@/lib/claimBuild/buildClaimProfiles", () => ({ buildClaimProfiles: m.profiles }));
vi.mock("@/lib/claimBuild/buildClaimSources", () => ({ buildClaimSources: m.sources }));
vi.mock("@/lib/claimBuild/buildClaimAbout", () => ({ buildClaimAbout: m.about }));
const { claimBuildWorkflow } = await import("@/lib/claimBuild/claimBuildWorkflow");

const ownership = { userId: "u1", expectedClaimId: "c1" };
beforeEach(() => {
  vi.clearAllMocks();
  m.conflict.mockResolvedValue(null);
  m.createHook.mockReturnValue({ getConflict: m.conflict, [Symbol.dispose]: m.dispose });
  m.profiles.mockResolvedValue(["bandcamp"]);
});

describe("claimBuildWorkflow", () => {
  it("builds a fresh claim: profiles, then sources with the guesses, then the About", async () => {
    m.step.mockResolvedValueOnce("profiles");
    await expect(claimBuildWorkflow("a1", ownership)).resolves.toEqual({ built: true });
    expect(m.createHook).toHaveBeenCalledWith({ token: "claim-build:a1" });
    expect(m.profiles).toHaveBeenCalledWith("a1", ownership);
    expect(m.sources).toHaveBeenCalledWith("a1", ownership, ["bandcamp"]);
    expect(m.about).toHaveBeenCalledWith("a1", ownership);
    expect(m.dispose).toHaveBeenCalled();
  });

  it("resumes at sources when profiles are already confirmed", async () => {
    m.step.mockResolvedValueOnce("vault");
    await claimBuildWorkflow("a1", ownership);
    expect(m.profiles).not.toHaveBeenCalled();
    expect(m.sources).toHaveBeenCalledWith("a1", ownership, []);
    expect(m.about).toHaveBeenCalled();
  });

  it.each(["interview", "publish"])("only writes the About when stopped at %s", async step => {
    m.step.mockResolvedValueOnce(step);
    await claimBuildWorkflow("a1", ownership);
    expect(m.profiles).not.toHaveBeenCalled();
    expect(m.sources).not.toHaveBeenCalled();
    expect(m.about).toHaveBeenCalledWith("a1", ownership);
  });

  it("does nothing for a page that's already built", async () => {
    m.step.mockResolvedValueOnce(null);
    await expect(claimBuildWorkflow("a1", ownership)).resolves.toEqual({ built: false });
    expect(m.about).not.toHaveBeenCalled();
  });

  it("leaves a build that's already running alone", async () => {
    m.conflict.mockResolvedValueOnce({ runId: "wrun_1" });
    await expect(claimBuildWorkflow("a1", ownership)).resolves.toEqual({
      built: false,
      runningIn: "wrun_1",
    });
    expect(m.step).not.toHaveBeenCalled();
  });
});

it("stops on source failure, releases the build hook, and resumes without rebuilding profiles", async () => {
  m.step.mockResolvedValueOnce("profiles").mockResolvedValueOnce("vault");
  m.sources.mockRejectedValueOnce(new Error("quota"));
  await expect(claimBuildWorkflow("a1", ownership)).rejects.toThrow("quota");
  expect(m.about).not.toHaveBeenCalled();
  expect(m.dispose).toHaveBeenCalledTimes(1);
  await expect(claimBuildWorkflow("a1", ownership)).resolves.toEqual({ built: true });
  expect(m.profiles).toHaveBeenCalledTimes(1);
  expect(m.sources).toHaveBeenLastCalledWith("a1", ownership, []);
  expect(m.about).toHaveBeenCalledTimes(1);
});
