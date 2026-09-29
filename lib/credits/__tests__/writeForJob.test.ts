import { describe, it, expect, vi } from "vitest";

const m = vi.hoisted(() => ({ withResearchJobWrite: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { name: "db" } }));
vi.mock("@/lib/research/withResearchJobWrite", () => ({
  withResearchJobWrite: (...a: unknown[]) => m.withResearchJobWrite(...a),
}));
const { writeForJob } = await import("@/lib/credits/writeForJob");

describe("writeForJob", () => {
  it("runs the write under the job's guard when a job is given", async () => {
    m.withResearchJobWrite.mockResolvedValueOnce("guarded");
    const write = vi.fn();
    expect(await writeForJob("a1", "job-1", write)).toBe("guarded");
    expect(m.withResearchJobWrite).toHaveBeenCalledWith("a1", "job-1", write);
    expect(write).not.toHaveBeenCalled();
  });

  it("runs the write against the database directly without a job", async () => {
    const write = vi.fn(async () => "direct");
    expect(await writeForJob("a1", undefined, write)).toBe("direct");
    expect(write).toHaveBeenCalledWith({ name: "db" });
  });
});
