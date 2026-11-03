import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  reserve: vi.fn(),
  refresh: vi.fn(),
  settle: vi.fn(),
  fail: vi.fn(),
  doc: vi.fn(),
}));
vi.mock("@/lib/bio/reserveAboutLoreRefresh", () => ({ reserveAboutLoreRefresh: m.reserve }));
vi.mock("@/lib/lore/refreshArtistDoc", () => ({ refreshArtistDoc: m.refresh }));
vi.mock("@/lib/bio/finishAboutLoreRefresh", () => ({ finishAboutLoreRefresh: m.settle }));
vi.mock("@/lib/research/failResearchJob", () => ({ failResearchJob: m.fail }));
vi.mock("@/lib/lore/getArtistDocStrict", () => ({ getArtistDocStrict: m.doc }));
const { prepareAboutLore } = await import("../prepareAboutLore");
const auth = { userId: "u", expectedClaimId: null };
const doc = { content: "Readable Lore", sources: [] };
beforeEach(() => {
  vi.resetAllMocks();
  m.reserve.mockResolvedValue({
    status: "acquired",
    jobId: "j",
    requestedAt: "t",
    claimedAt: "lease",
  });
  m.refresh.mockResolvedValue("rebuilt");
  m.settle.mockResolvedValue(true);
  m.doc.mockResolvedValue(doc);
});
describe("prepareAboutLore", () => {
  it("creates missing Lore before returning the saved document", async () => {
    expect(await prepareAboutLore("a", auth)).toEqual({
      ...doc,
      aboutLease: { jobId: "j", requestedAt: "t", claimedAt: "lease" },
    });
    expect(m.refresh).toHaveBeenCalledWith("a", {
      createIfMissing: true,
      jobId: "j",
      expectedClaimId: null,
      auth,
      lease: { jobId: "j", requestedAt: "t", claimedAt: "lease" },
    });
    expect(m.settle).not.toHaveBeenCalled();
    expect(m.doc.mock.invocationCallOrder[0]).toBeGreaterThan(
      m.refresh.mock.invocationCallOrder[0],
    );
  });
  it("reuses a current document without rebuilding", async () => {
    m.reserve.mockResolvedValue({
      status: "acquired",
      jobId: "j",
      requestedAt: "t",
      claimedAt: "lease",
      needsRefresh: false,
    });
    expect(await prepareAboutLore("a", auth)).toEqual({
      ...doc,
      aboutLease: { jobId: "j", requestedAt: "t", claimedAt: "lease" },
    });
    expect(m.refresh).not.toHaveBeenCalled();
  });
  it("returns busy immediately without starting a second Lore or About operation", async () => {
    m.reserve.mockResolvedValue({ status: "busy" });
    expect(await prepareAboutLore("a", auth)).toMatchObject({
      httpStatus: 409,
      code: "LORE_PREPARING",
    });
    expect(m.reserve).toHaveBeenCalledTimes(1);
    expect(m.refresh).not.toHaveBeenCalled();
  });
  it("explains that approved readable material is required", async () => {
    m.refresh.mockResolvedValue("no-material");
    expect(await prepareAboutLore("a", auth)).toMatchObject({
      httpStatus: 409,
      code: "LORE_REQUIRED",
      error: expect.stringContaining("approved, readable"),
    });
    expect(m.doc).not.toHaveBeenCalled();
  });
  it("records a preparation failure for the existing retry worker", async () => {
    m.refresh.mockResolvedValue("failed");
    expect(await prepareAboutLore("a", auth)).toMatchObject({
      httpStatus: 500,
      code: "LORE_PREPARATION_FAILED",
    });
    expect(m.settle).toHaveBeenCalledWith(
      "a",
      { jobId: "j", requestedAt: "t", claimedAt: "lease" },
      "failed",
    );
  });
  it("does not use a document after ownership changed", async () => {
    m.refresh.mockResolvedValue("cancelled");
    expect(await prepareAboutLore("a", auth)).toMatchObject({ httpStatus: 409 });
    expect(m.doc).not.toHaveBeenCalled();
  });
  it("does not generate About while newer sources still need a refresh", async () => {
    m.refresh.mockResolvedValue("changed");
    m.settle.mockResolvedValue(false);
    expect(await prepareAboutLore("a", auth)).toMatchObject({
      httpStatus: 409,
      error: expect.stringContaining("sources changed"),
    });
    expect(m.doc).not.toHaveBeenCalled();
  });
  it("does not turn a failed document read into missing material", async () => {
    m.reserve.mockResolvedValue({
      status: "acquired",
      jobId: "j",
      requestedAt: "t",
      claimedAt: "lease",
      needsRefresh: false,
    });
    m.doc.mockRejectedValue(new Error("offline"));
    expect(await prepareAboutLore("a", auth)).toMatchObject({
      httpStatus: 500,
      code: "LORE_PREPARATION_FAILED",
    });
  });
});
it("recovers its own lease when settlement throws once", async () => {
  m.refresh.mockResolvedValue("failed");
  m.settle.mockRejectedValueOnce(new Error("transient")).mockResolvedValue(false);
  expect(await prepareAboutLore("a", auth)).toMatchObject({ httpStatus: 500 });
  expect(m.settle).toHaveBeenCalledTimes(2);
  expect(m.settle.mock.calls[1][2]).toBe("failed");
});
it("reports recovery delay if both settlement and cleanup fail", async () => {
  m.refresh.mockResolvedValue("failed");
  m.settle.mockRejectedValue(new Error("offline"));
  expect(await prepareAboutLore("a", auth)).toMatchObject({
    httpStatus: 500,
    error: expect.stringContaining("few minutes"),
  });
});
it("cleans up an unexpected refresh rejection", async () => {
  m.refresh.mockRejectedValue(new Error("unexpected"));
  expect(await prepareAboutLore("a", auth)).toMatchObject({ httpStatus: 500 });
  expect(m.settle.mock.calls[0][2]).toBe("failed");
});
it("does not reserve or generate after the request deadline", async () => {
  const signal = AbortSignal.abort(new Error("deadline"));
  expect(await prepareAboutLore("a", auth, { signal })).toMatchObject({ httpStatus: 500 });
  expect(m.reserve).not.toHaveBeenCalled();
  expect(m.refresh).not.toHaveBeenCalled();
});
