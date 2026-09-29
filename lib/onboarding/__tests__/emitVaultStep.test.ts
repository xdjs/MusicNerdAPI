import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";

const m = vi.hoisted(() => ({ sources: vi.fn(), search: vi.fn() }));
vi.mock("@/lib/vault/getVaultSourcesByStatus", () => ({ getVaultSourcesByStatus: m.sources }));
vi.mock("@/lib/vault/searchAndPopulateVault", () => ({ searchAndPopulateVault: m.search }));
const { emitVaultStep } = await import("@/lib/onboarding/emitVaultStep");

const src = (id: string, extra: object = {}) => ({
  id,
  title: `T${id}`,
  url: `https://ex.com/${id}`,
  snippet: "s",
  ogImage: null,
  extractedText: "x".repeat(500),
  status: "pending",
  filePath: null,
  ...extra,
});

beforeEach(() => {
  m.sources.mockReset().mockResolvedValue([]);
  m.search.mockReset().mockResolvedValue([]);
});

describe("emitVaultStep", () => {
  it("shows pending sources with whether each was verified, without searching", async () => {
    m.sources.mockImplementation(async (_a: string, status: string) =>
      status === "pending" ? [src("1"), src("2", { extractedText: null })] : [],
    );
    const events = await collect(emitVaultStep("a1", false));
    expect(events[0]).toEqual({
      kind: "chat",
      text: expect.stringMatching(/^We found 2 sources about you\./),
    });
    expect(events[1]).toEqual({
      kind: "step",
      step: "vault",
      payload: {
        sources: [
          {
            id: "1",
            title: "T1",
            url: "https://ex.com/1",
            snippet: "s",
            ogImage: null,
            verified: true,
          },
          {
            id: "2",
            title: "T2",
            url: "https://ex.com/2",
            snippet: "s",
            ogImage: null,
            verified: false,
          },
        ],
      },
    });
    expect(m.search).not.toHaveBeenCalled();
  });

  it("searches the web, bounded, when nothing is pending and nothing web-found is approved", async () => {
    m.sources.mockImplementation(async (_a: string, status: string) =>
      status === "approved" ? [src("u", { filePath: "uploads/x.pdf", status: "approved" })] : [],
    );
    const events = await collect(emitVaultStep("a1", false));
    expect(m.search).toHaveBeenCalledWith("a1", { deadline: expect.any(Number) });
    expect(events.filter(e => e.kind === "progress")).toEqual([
      { kind: "progress", label: "Searching the web for sources about you", done: false },
      { kind: "progress", label: "Searching the web for sources about you", done: true },
    ]);
    expect(events.find(e => e.kind === "chat")).toEqual({
      kind: "chat",
      text: expect.stringMatching(/^We didn't find much about you on the web yet/),
    });
  });

  it("searches again when forced, even with pending sources", async () => {
    m.sources.mockImplementation(async (_a: string, status: string) =>
      status === "pending" ? [src("1")] : [src("a", { status: "approved" })],
    );
    await collect(emitVaultStep("a1", true));
    expect(m.search).toHaveBeenCalled();
  });

  it("doesn't search when the web was already searched", async () => {
    m.sources.mockImplementation(async (_a: string, status: string) =>
      status === "approved" ? [src("a", { status: "approved" })] : [],
    );
    await collect(emitVaultStep("a1", false));
    expect(m.search).not.toHaveBeenCalled();
  });
});
