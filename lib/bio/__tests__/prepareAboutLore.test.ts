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
vi.mock("@/lib/research/settleLoreRefresh", () => ({ settleLoreRefresh: m.settle }));
vi.mock("@/lib/research/failResearchJob", () => ({ failResearchJob: m.fail }));
vi.mock("@/lib/lore/getArtistDocStrict", () => ({ getArtistDocStrict: m.doc }));
const { prepareAboutLore } = await import("../prepareAboutLore");
const auth = { userId: "u", expectedClaimId: null };
const doc = { content: "Readable Lore", sources: [] };
beforeEach(() => {
  vi.resetAllMocks();
  m.reserve.mockResolvedValue({ status: "acquired", jobId: "j", requestedAt: "t" });
  m.refresh.mockResolvedValue("rebuilt");
  m.settle.mockResolvedValue(true);
  m.doc.mockResolvedValue(doc);
});
describe("prepareAboutLore", () => {
  it("creates missing Lore before returning the saved document", async () => {
    expect(await prepareAboutLore("a", auth)).toEqual(doc);
    expect(m.refresh).toHaveBeenCalledWith("a", {
      createIfMissing: true,
      jobId: "j",
      expectedClaimId: null,
      auth,
    });
    expect(m.settle).toHaveBeenCalledWith("j", "t");
    expect(m.doc.mock.invocationCallOrder[0]).toBeGreaterThan(
      m.refresh.mock.invocationCallOrder[0],
    );
  });
  it("reuses a current document without rebuilding", async () => {
    m.reserve.mockResolvedValue({ status: "ready" });
    expect(await prepareAboutLore("a", auth)).toEqual(doc);
    expect(m.refresh).not.toHaveBeenCalled();
  });
  it("waits for another worker, then uses its document without duplicate generation", async () => {
    vi.useFakeTimers();
    m.reserve.mockResolvedValueOnce({ status: "busy" }).mockResolvedValue({ status: "ready" });
    const result = prepareAboutLore("a", auth);
    await vi.runAllTimersAsync();
    expect(await result).toEqual(doc);
    expect(m.refresh).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it("bounds waiting for an in-flight or differently purposed job", async () => {
    vi.useFakeTimers();
    m.reserve.mockResolvedValue({ status: "busy" });
    const result = prepareAboutLore("a", auth);
    await vi.runAllTimersAsync();
    expect(await result).toMatchObject({ httpStatus: 409, code: "LORE_PREPARING" });
    expect(m.refresh).not.toHaveBeenCalled();
    vi.useRealTimers();
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
    expect(m.fail).toHaveBeenCalledWith("j", "Could not prepare Lore for About");
    expect(m.settle).not.toHaveBeenCalled();
  });
  it("does not use a document after ownership changed", async () => {
    m.refresh.mockResolvedValue("cancelled");
    expect(await prepareAboutLore("a", auth)).toMatchObject({ httpStatus: 409 });
    expect(m.doc).not.toHaveBeenCalled();
  });
  it("does not generate About while newer sources still need a refresh", async () => {
    m.settle.mockResolvedValue(false);
    expect(await prepareAboutLore("a", auth)).toMatchObject({
      httpStatus: 409,
      code: "LORE_PREPARING",
    });
    expect(m.doc).not.toHaveBeenCalled();
  });
  it("does not turn a failed document read into missing material", async () => {
    m.reserve.mockResolvedValue({ status: "ready" });
    m.doc.mockRejectedValue(new Error("offline"));
    expect(await prepareAboutLore("a", auth)).toMatchObject({
      httpStatus: 500,
      code: "LORE_PREPARATION_FAILED",
    });
  });
});
