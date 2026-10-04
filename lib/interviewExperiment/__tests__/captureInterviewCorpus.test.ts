import { beforeEach, describe, expect, it, vi } from "vitest";
const tx = vi.fn(),
  end = vi.fn(),
  begin = vi.fn((_mode: string, fn: (sql: unknown) => unknown) => fn(tx));
const connect = vi.fn(() => ({ begin, end }));
vi.mock("postgres", () => ({ default: () => connect() }));
const { captureInterviewCorpus } = await import("@/lib/interviewExperiment/captureInterviewCorpus");
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  tx.mockReset();
});
describe("captureInterviewCorpus", () => {
  it("reads only the requested artist in a read-only app-role transaction", async () => {
    tx.mockResolvedValueOnce([{ role: "mnweb", readonly: "on" }]).mockResolvedValueOnce([
      { id, name: "Artist", instagram: "handle" },
    ]);
    for (let i = 0; i < 5; i++) tx.mockResolvedValueOnce([]);
    const c = await captureInterviewCorpus(id, "handle", "postgres://unused", "production");
    expect(begin.mock.calls[0][0]).toContain("read only");
    expect(c).toMatchObject({ environment: "production", artist: { id }, evidence: [] });
    expect(tx.mock.calls.slice(1).every(args => args.includes(id))).toBe(true);
    expect(end).toHaveBeenCalledOnce();
  });
  it("rejects owner-role access or a wrong connected artist before collecting sources", async () => {
    tx.mockResolvedValueOnce([{ role: "postgres", readonly: "on" }]);
    await expect(
      captureInterviewCorpus(id, "handle", "postgres://unused", "production"),
    ).rejects.toThrow(/mnweb/);
    expect(tx).toHaveBeenCalledTimes(1);
    tx.mockReset()
      .mockResolvedValueOnce([{ role: "mnweb", readonly: "on" }])
      .mockResolvedValueOnce([{ id, name: "Namesake", instagram: "different" }]);
    await expect(
      captureInterviewCorpus(id, "handle", "postgres://unused", "production"),
    ).rejects.toThrow(/identity/);
    expect(tx).toHaveBeenCalledTimes(2);
  });
  it("propagates incomplete source reads and closes the connection", async () => {
    tx.mockResolvedValueOnce([{ role: "mnweb", readonly: "on" }])
      .mockResolvedValueOnce([{ id, name: "Artist", instagram: "handle" }])
      .mockRejectedValueOnce(new Error("read failed"));
    await expect(
      captureInterviewCorpus(id, "handle", "postgres://unused", "production"),
    ).rejects.toThrow("read failed");
    expect(end).toHaveBeenCalledOnce();
  });
});
