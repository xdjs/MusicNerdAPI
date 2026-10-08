import { beforeEach, describe, expect, it, vi } from "vitest";
import { captionJob } from "@/lib/research/__tests__/captionJob";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const m = vi.hoisted(() => ({
  execute: vi.fn(),
  withResearchJobWrite: vi.fn(),
  findApprovedClaim: vi.fn(),
  queueLoreRefreshInTransaction: vi.fn(),
}));
vi.mock("@/lib/research/withResearchJobWrite", () => ({
  withResearchJobWrite: (...a: unknown[]) => m.withResearchJobWrite(...a),
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({
  findApprovedClaim: (...a: unknown[]) => m.findApprovedClaim(...a),
}));
vi.mock("@/lib/research/queueLoreRefreshInTransaction", () => ({
  queueLoreRefreshInTransaction: (...a: unknown[]) => m.queueLoreRefreshInTransaction(...a),
}));
const { queueLoreRefreshAfterCaptions } =
  await import("@/lib/research/queueLoreRefreshAfterCaptions");
const tx = { execute: m.execute };

beforeEach(() => {
  vi.clearAllMocks();
  m.withResearchJobWrite.mockImplementation(
    async (_artist: string, _job: string, write: (tx: unknown) => Promise<unknown>) => write(tx),
  );
  m.execute.mockResolvedValueOnce([{ state: {} }]).mockResolvedValueOnce([]);
  m.findApprovedClaim.mockResolvedValue({ id: "claim-1" });
});

describe("queueLoreRefreshAfterCaptions", () => {
  it("queues under the parent caption job and commits a retry marker", async () => {
    const job = captionJob();
    expect(await queueLoreRefreshAfterCaptions(job)).toBe(true);
    expect(m.withResearchJobWrite).toHaveBeenCalledWith("artist-1", "job-1", expect.any(Function));
    expect(m.queueLoreRefreshInTransaction).toHaveBeenCalledWith(tx, "artist-1", "claim-1");
    const select = renderSql(m.execute.mock.calls[0][0]);
    const update = renderSql(m.execute.mock.calls[1][0]);
    expect(select.text).toContain("for update");
    expect(select.text).toContain("status in ('pending', 'running')");
    expect(update.text).toContain("'{loreRefreshQueued}'");
  });

  it("does not requeue after the first handoff survives a killed caption tail", async () => {
    m.execute.mockReset().mockResolvedValueOnce([{ state: { loreRefreshQueued: true } }]);
    expect(await queueLoreRefreshAfterCaptions(captionJob())).toBe(false);
    expect(m.findApprovedClaim).not.toHaveBeenCalled();
    expect(m.queueLoreRefreshInTransaction).not.toHaveBeenCalled();
    expect(m.execute).toHaveBeenCalledTimes(1);
  });

  it("does not enqueue from a completed or missing caption job", async () => {
    m.execute.mockReset().mockResolvedValueOnce([]);
    expect(await queueLoreRefreshAfterCaptions(captionJob())).toBe(false);
    expect(m.queueLoreRefreshInTransaction).not.toHaveBeenCalled();
  });

  it("lets a queue failure retry the caption tail instead of marking it complete", async () => {
    m.queueLoreRefreshInTransaction.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(queueLoreRefreshAfterCaptions(captionJob())).rejects.toThrow(
      "database unavailable",
    );
    expect(m.execute).toHaveBeenCalledTimes(1);
  });
});
