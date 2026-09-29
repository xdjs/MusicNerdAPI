import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";
import { emitStepMock } from "@/lib/onboarding/__tests__/emitStepMock";
import { turnContext } from "@/lib/onboarding/__tests__/turnContext";

const m = vi.hoisted(() => ({
  emitStep: vi.fn(),
  get: vi.fn(),
  status: vi.fn(),
  insert: vi.fn(),
  enrich: vi.fn(),
  unsafe: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock("@/lib/onboarding/emitStep", () => ({ emitStep: m.emitStep }));
vi.mock("@/lib/vault/getVaultSourceByIdAndArtist", () => ({ getVaultSourceByIdAndArtist: m.get }));
vi.mock("@/lib/vault/updateVaultSourceStatus", () => ({ updateVaultSourceStatus: m.status }));
vi.mock("@/lib/vault/insertVaultSource", () => ({ insertVaultSource: m.insert }));
vi.mock("@/lib/onboarding/enrichVaultSource", () => ({ enrichVaultSource: m.enrich }));
vi.mock("@/lib/pages/isUnsafeUrl", () => ({ isUnsafeUrl: m.unsafe }));
vi.mock("@/lib/onboarding/confirmOnboardingStep", () => ({ confirmOnboardingStep: m.confirm }));
const { handleVaultReviewTurn } = await import("@/lib/onboarding/handleVaultReviewTurn");

beforeEach(() => {
  m.emitStep.mockReset().mockImplementation(emitStepMock());
  m.get.mockReset().mockImplementation(async (id: string) => (id === "mine" ? { id } : undefined));
  m.status.mockReset().mockResolvedValue({});
  m.insert.mockReset().mockResolvedValue({ id: "new" });
  m.enrich.mockReset().mockResolvedValue(undefined);
  m.unsafe.mockReset().mockReturnValue(false);
  m.confirm.mockReset().mockResolvedValue(undefined);
});

describe("handleVaultReviewTurn", () => {
  it("applies decisions to the artist's own sources, adds pasted links as approved and moves on", async () => {
    const events = await collect(
      handleVaultReviewTurn(turnContext("vault"), {
        type: "vault_review",
        decisions: [
          { sourceId: "mine", status: "rejected" },
          { sourceId: "theirs", status: "approved" },
        ],
        addedUrls: ["example.com/review", "not a url"],
      }),
    );
    expect(m.status.mock.calls).toEqual([["mine", "rejected"]]);
    expect(m.insert).toHaveBeenCalledWith({
      artistId: "a1",
      url: "https://example.com/review",
      type: "review",
      status: "approved",
    });
    expect(m.enrich).toHaveBeenCalledWith("new", "https://example.com/review", {
      keepTitle: false,
    });
    expect(m.confirm).toHaveBeenCalledWith("a1", "vault");
    expect(events).toEqual([
      {
        kind: "chat",
        text: "Sources sorted. Now the fun part — three quick questions. Skip any of them.",
      },
      { kind: "step", step: "interview", payload: null },
    ]);
  });

  it("skips an unsafe URL and survives a failed insert", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.unsafe.mockReturnValueOnce(true);
    m.insert.mockRejectedValueOnce(new Error("pool"));
    await collect(
      handleVaultReviewTurn(turnContext("vault"), {
        type: "vault_review",
        decisions: [],
        addedUrls: ["http://10.0.0.1/x", "https://ok.com/a"],
      }),
    );
    expect(m.insert).toHaveBeenCalledTimes(1);
    expect(m.confirm).toHaveBeenCalled();
    error.mockRestore();
  });

  it("resyncs a stale card", async () => {
    const events = await collect(
      handleVaultReviewTurn(turnContext("profiles"), {
        type: "vault_review",
        decisions: [],
        addedUrls: [],
      }),
    );
    expect(events[0]).toMatchObject({ kind: "error" });
    expect(m.confirm).not.toHaveBeenCalled();
  });
});
