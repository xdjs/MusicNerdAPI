import { describe, it, expect, vi, beforeEach } from "vitest";
import { profile } from "@/lib/onboarding/__tests__/profile";

const m = vi.hoisted(() => ({
  artist: vi.fn(),
  links: vi.fn(),
  search: vi.fn(),
  sources: vi.fn(),
  status: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.artist }));
vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks: m.links }));
vi.mock("@/lib/vault/searchAndPopulateVault", () => ({ searchAndPopulateVault: m.search }));
vi.mock("@/lib/vault/getVaultSourcesByStatus", () => ({ getVaultSourcesByStatus: m.sources }));
vi.mock("@/lib/vault/updateVaultSourceStatus", () => ({ updateVaultSourceStatus: m.status }));
vi.mock("@/lib/onboarding/confirmOnboardingStep", () => ({ confirmOnboardingStep: m.confirm }));
const { autoBuildSources } = await import("@/lib/onboarding/autoBuildSources");

async function run(provisional: string[] = [], discovered = new Map()) {
  const events: import("@/lib/onboarding/types").TurnEvent[] = [];
  const gen = autoBuildSources("a1", provisional, discovered);
  for (;;) {
    const step = await gen.next();
    if (step.done) return { events, result: step.value };
    events.push(step.value);
  }
}

const pending = [
  { id: "p1", url: "https://a.com/1", title: "One", ogImage: null, extractedText: "x".repeat(500) },
  { id: "p2", url: "https://a.com/2", title: "Two", ogImage: null, extractedText: null },
];

beforeEach(() => {
  m.artist
    .mockReset()
    .mockResolvedValueOnce({ id: "a1", instagram: "guess" })
    .mockResolvedValue({ id: "a1", instagram: "real", bandcamp: "nova" });
  m.links.mockReset().mockResolvedValue([
    {
      siteName: "instagram",
      cardPlatformName: "Instagram",
      siteImage: null,
      colorHex: null,
      appStringFormat: "https://instagram.com/%@",
    },
    {
      siteName: "bandcamp",
      cardPlatformName: "Bandcamp",
      siteImage: null,
      colorHex: null,
      appStringFormat: "https://%@.bandcamp.com",
    },
  ]);
  m.search
    .mockReset()
    .mockImplementation(async (_a: string, opts: { onSaved: (s: unknown) => void }) => {
      opts.onSaved({ url: "https://a.com/1", title: "One", ogImage: null });
      return [];
    });
  m.sources
    .mockReset()
    .mockImplementation(async (_a: string, status: string) =>
      status === "pending" ? pending : [{ url: "https://old.com", title: "Old", ogImage: "i" }],
    );
  m.status.mockReset().mockResolvedValue({});
  m.confirm.mockReset().mockResolvedValue(undefined);
});

describe("autoBuildSources", () => {
  it("streams saved sources, reports adopted links, approves everything pending and confirms the vault", async () => {
    const guessed = profile("instagram", "guess", { provisional: true });
    const { events, result } = await run(["instagram"], new Map([["instagram", guessed]]));
    expect(m.search).toHaveBeenCalledWith("a1", {
      deadline: expect.any(Number),
      requireComplete: true,
      provisionalSiteNames: ["instagram"],
      onSaved: expect.any(Function),
    });
    expect(events[0]).toEqual({
      kind: "progress",
      label: "Reading what's written about you",
      done: false,
      group: "source-search",
    });
    expect(events[1]).toEqual({
      kind: "source",
      source: { title: "One", url: "https://a.com/1", ogImage: null },
    });
    expect(events[2]).toMatchObject({ kind: "linked" });
    expect(
      (events[2] as { profiles: { siteName: string }[] }).profiles.map(p => p.siteName),
    ).toEqual(["instagram", "bandcamp"]);
    expect(events[3]).toMatchObject({ kind: "choices", platform: "instagram", chosen: "real" });
    expect(m.status.mock.calls).toEqual([
      ["p1", "approved"],
      ["p2", "approved"],
    ]);
    expect(events[4]).toEqual({
      kind: "sources",
      sources: [{ title: "Old", url: "https://old.com", ogImage: "i" }],
    });
    expect(events[5]).toEqual({
      kind: "progress",
      label: "Read 2 sources",
      done: true,
      group: "source-search",
    });
    expect(m.confirm).toHaveBeenCalledWith("a1", "vault");
    expect(result.citable).toBe(1);
  });

  it("rejects a failed search without approving or confirming, then can retry", async () => {
    const failure = new Error("Web search failed (tavily: http_432)");
    m.search.mockRejectedValueOnce(failure);
    await expect(run()).rejects.toBe(failure);
    expect(m.status).not.toHaveBeenCalled();
    expect(m.confirm).not.toHaveBeenCalled();
    await run();
    expect(m.confirm).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing best-effort approval behavior after a successful search", async () => {
    m.status.mockRejectedValueOnce(new Error("pool"));
    const { events } = await run();
    expect(m.status).toHaveBeenCalledTimes(2);
    expect(m.confirm).toHaveBeenCalledWith("a1", "vault");
    expect(events.at(-1)).toMatchObject({ kind: "progress", done: true });
  });

  it("says it looked when nothing was pending", async () => {
    m.sources.mockImplementation(async () => []);
    const { events, result } = await run();
    expect(events.at(-1)).toEqual({
      kind: "progress",
      label: "Looked for sources about you",
      done: true,
      group: "source-search",
    });
    expect(result.citable).toBe(0);
  });
});

it("retains a streamed partial source on failure and approves it on retry", async () => {
  const failure = new Error("Web search failed (tavily: http_432)");
  m.search.mockImplementationOnce(async (_a, options) => {
    options.onSaved(pending[0]);
    throw failure;
  });
  const events: import("@/lib/onboarding/types").TurnEvent[] = [];
  const collect = async () => {
    for await (const event of autoBuildSources("a1", [], new Map())) events.push(event);
  };
  await expect(collect()).rejects.toBe(failure);
  expect(events).toContainEqual({
    kind: "source",
    source: { title: "One", url: "https://a.com/1", ogImage: null },
  });
  expect(m.confirm).not.toHaveBeenCalled();
  expect(m.status).not.toHaveBeenCalled();
  await run();
  expect(m.status).toHaveBeenCalledWith("p1", "approved");
});

it("does not confirm at the old timeout boundary or hide a later provider failure", async () => {
  vi.useFakeTimers();
  try {
    let rejectSearch!: (reason: Error) => void;
    m.search.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectSearch = reject;
        }),
    );
    const result = run();
    const rejected = expect(result).rejects.toThrow("late quota failure");
    await vi.advanceTimersByTimeAsync(46_000);
    expect(m.confirm).not.toHaveBeenCalled();
    rejectSearch(new Error("late quota failure"));
    await rejected;
    expect(m.confirm).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it("does not confirm when the consumer cancels after a partial source", async () => {
  const stage = autoBuildSources("a1", [], new Map());
  await stage.next();
  expect((await stage.next()).value).toMatchObject({ kind: "source" });
  await stage.return({ citable: 0 });
  expect(m.confirm).not.toHaveBeenCalled();
});
