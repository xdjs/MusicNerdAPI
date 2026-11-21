import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  findFirst: vi.fn(),
  where: vi.fn(async (_set: unknown, _where: unknown) => {}),
  values: vi.fn(async () => {}),
  send: vi.fn(async () => {}),
}));
vi.mock("@/lib/db/db", () => ({
  db: {
    query: { ugcresearch: { findFirst: m.findFirst } },
    update: () => ({ set: (v: unknown) => ({ where: (w: unknown) => m.where(v, w) }) }),
    insert: () => ({ values: m.values }),
  },
}));
vi.mock("@/lib/discord/sendDiscordMessage", () => ({ sendDiscordMessage: m.send }));
const { maybePingDiscordForPendingUGC } = await import("@/lib/ugc/maybePingDiscordForPendingUGC");

beforeEach(() => vi.clearAllMocks());

describe("maybePingDiscordForPendingUGC", () => {
  it("pings the admin role and records the time when it has never pinged", async () => {
    m.findFirst.mockResolvedValue(undefined);
    await maybePingDiscordForPendingUGC();
    expect(m.send).toHaveBeenCalledWith("<@&1091088804028362944> New UGC awaiting review!");
    expect(m.values).toHaveBeenCalledWith(
      expect.objectContaining({ siteName: "ugc_discord_ping", accepted: true }),
    );
  });

  it("stays quiet within 15 minutes of the last ping", async () => {
    m.findFirst.mockResolvedValue({
      id: "s",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    });
    await maybePingDiscordForPendingUGC();
    expect(m.send).not.toHaveBeenCalled();
    expect(m.where).not.toHaveBeenCalled();
  });

  it("pings again after 15 minutes and moves the sentinel's time", async () => {
    m.findFirst.mockResolvedValue({
      id: "s",
      createdAt: new Date(Date.now() - 901_000).toISOString(),
    });
    await maybePingDiscordForPendingUGC();
    expect(m.send).toHaveBeenCalledOnce();
    expect(m.where).toHaveBeenCalledWith({ createdAt: expect.any(String) }, expect.anything());
    expect(m.values).not.toHaveBeenCalled();
  });
});
