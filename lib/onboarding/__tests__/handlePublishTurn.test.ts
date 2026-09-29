import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";
import { emitStepMock } from "@/lib/onboarding/__tests__/emitStepMock";
import { turnContext } from "@/lib/onboarding/__tests__/turnContext";

const m = vi.hoisted(() => ({ emitStep: vi.fn(), persist: vi.fn() }));
vi.mock("@/lib/onboarding/emitStep", () => ({ emitStep: m.emitStep }));
vi.mock("@/lib/bio/persistArtistBio", () => ({ persistArtistBio: m.persist }));
const { handlePublishTurn } = await import("@/lib/onboarding/handlePublishTurn");

const turn = (o: object = {}) => ({
  type: "publish" as const,
  doc: "## Overview\nCited[1].",
  about: "About[1].",
  expectedBio: null,
  ...o,
});

beforeEach(() => {
  m.emitStep.mockReset().mockImplementation(emitStepMock());
  m.persist.mockReset().mockResolvedValue("About.");
});

describe("handlePublishTurn", () => {
  it("publishes the clean About with the document and its sources, then completes", async () => {
    const sources = [{ id: 1, kind: "vault", label: "A", url: "https://a" }, "junk"];
    const ctx = turnContext("publish");
    const events = await collect(handlePublishTurn(ctx, turn({ sources })));
    expect(m.persist).toHaveBeenCalledWith("a1", "About.", {
      generated: true,
      ownership: ctx.ownership,
      expectedBio: null,
      document: { content: "## Overview\nCited[1].", sources: [sources[0]] },
      confirmSteps: ["publish"],
    });
    expect(events).toEqual([
      { kind: "chat", text: expect.stringMatching(/^You're live!/) },
      { kind: "complete" },
    ]);
  });

  it("regenerates a bad document or About", async () => {
    let events = await collect(handlePublishTurn(turnContext("publish"), turn({ doc: " " })));
    expect(events[0]).toEqual({
      kind: "error",
      message: "That doc looks off — let me regenerate it.",
    });
    events = await collect(
      handlePublishTurn(turnContext("publish"), turn({ about: "x".repeat(10_001) })),
    );
    expect(events[0]).toEqual({
      kind: "error",
      message: "That About looks off — let me regenerate it.",
    });
    expect(m.persist).not.toHaveBeenCalled();
  });

  it("fails closed on a draft with no starting bio snapshot", async () => {
    const events = await collect(
      handlePublishTurn(turnContext("publish"), turn({ expectedBio: undefined })),
    );
    expect(events).toEqual([
      {
        kind: "error",
        message:
          "This draft is missing its starting bio. Reload and generate a fresh draft before publishing.",
      },
    ]);
    expect(m.persist).not.toHaveBeenCalled();
  });

  it("just completes after onboarding is done, and resyncs on another step", async () => {
    expect(await collect(handlePublishTurn(turnContext(null), turn()))).toEqual([
      { kind: "chat", text: expect.stringMatching(/^You're all set/) },
      { kind: "complete" },
    ]);
    const events = await collect(handlePublishTurn(turnContext("profiles"), turn()));
    expect(events[0]).toMatchObject({ kind: "error" });
  });
});
