import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";

const m = vi.hoisted(() => ({ payload: vi.fn(), discover: vi.fn() }));
vi.mock("@/lib/onboarding/buildProfilesPayload", () => ({ buildProfilesPayload: m.payload }));
vi.mock("@/lib/discovery/discoverArtistProfilesStream", () => ({
  discoverArtistProfilesStream: m.discover,
}));
const { emitProfilesStep } = await import("@/lib/onboarding/emitProfilesStep");

const profile = (siteName: string) => ({
  siteName,
  displayName: siteName,
  value: "v",
  profileUrl: "u",
  logoUrl: null,
  colorHex: null,
  previewImage: null,
  reasoning: null,
  provisional: false,
});

beforeEach(() => {
  m.payload.mockReset().mockResolvedValue({
    artistName: "Nova",
    links: [{ siteName: "spotify", value: "s" }],
    enrichment: null,
  });
  m.discover.mockReset().mockImplementation(async function* () {
    yield { kind: "searching", platform: "instagram", displayName: "Instagram" };
    yield { kind: "searching", platform: "instagram", displayName: "Instagram" };
    yield { kind: "searching", platform: "x", displayName: "X" };
    yield { kind: "found", profile: profile("instagram") };
    yield { kind: "unreachable", platform: "tiktok", displayName: "TikTok" };
  });
});

describe("emitProfilesStep", () => {
  it("without discovery: gathers, narrates and emits the card", async () => {
    const events = await collect(emitProfilesStep("a1", false));
    expect(events).toEqual([
      { kind: "progress", label: "Gathering your profiles", done: false },
      { kind: "progress", label: "Gathering your profiles", done: true },
      {
        kind: "chat",
        text: expect.stringMatching(/^First: here's everything we have linked to you\./),
      },
      {
        kind: "step",
        step: "profiles",
        payload: {
          artistName: "Nova",
          links: [{ siteName: "spotify", value: "s" }],
          enrichment: null,
          candidates: [],
          unreachable: [],
        },
      },
    ]);
    expect(m.discover).not.toHaveBeenCalled();
  });

  it("with discovery: one collapsing line per distinct platform, candidates live, unreachable in the payload", async () => {
    const events = await collect(emitProfilesStep("a1", true));
    expect(events.filter(e => e.kind === "progress" && "group" in e)).toEqual([
      { kind: "progress", label: "Searching 1 platform…", done: false, group: "platform-search" },
      { kind: "progress", label: "Searching 2 platforms…", done: false, group: "platform-search" },
      { kind: "progress", label: "Searched 2 platforms", done: true, group: "platform-search" },
    ]);
    expect(events.filter(e => e.kind === "candidate")).toEqual([
      { kind: "candidate", profile: profile("instagram") },
    ]);
    const chat = events.find(e => e.kind === "chat") as { text: string };
    expect(chat.text).toMatch(/I also found 1 more profile by searching the web/);
    const step = events.at(-1) as { payload: { candidates: unknown[]; unreachable: string[] } };
    expect(step.payload.candidates).toHaveLength(1);
    expect(step.payload.unreachable).toEqual(["tiktok"]);
  });

  it("says where to start when there are no links, and survives a failed discovery stream", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.payload.mockResolvedValueOnce({ artistName: "Nova", links: [], enrichment: null });
    m.discover.mockImplementationOnce(async function* () {
      throw new Error("boom");
    });
    const events = await collect(emitProfilesStep("a1", true));
    expect((events.find(e => e.kind === "chat") as { text: string }).text).toMatch(
      /^Let's start with where people can find you\./,
    );
    expect(events.at(-1)).toMatchObject({ kind: "step", step: "profiles" });
    error.mockRestore();
  });
});
