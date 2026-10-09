import { beforeEach, expect, it, vi } from "vitest";
import type { ResearchJob } from "@/lib/research/types";
import { refreshLatestProvider } from "../refreshLatestProvider";
const m = vi.hoisted(() => ({ fetch: vi.fn(), persist: vi.fn() }));
vi.mock("../fetchLatestProviderItems", () => ({ fetchLatestProviderItems: m.fetch }));
vi.mock("../persistLatestProviderSnapshot", () => ({ persistLatestProviderSnapshot: m.persist }));
const job = { state: { deezer: "12" } } as unknown as ResearchJob;
beforeEach(() => {
  vi.resetAllMocks();
  m.fetch.mockResolvedValue([]);
  m.persist.mockResolvedValue(undefined);
});
it("persists even an empty successful provider window", async () => {
  expect(await refreshLatestProvider(job, "deezer")).toMatchObject({ status: "checked" });
  expect(m.persist).toHaveBeenCalledWith(job, "deezer", "12", []);
});
it("records provider failures without replacing healthy stored content", async () => {
  m.fetch.mockRejectedValue(new Error("upstream"));
  expect(await refreshLatestProvider(job, "deezer")).toEqual({ status: "failed" });
  expect(m.persist).toHaveBeenCalledWith(job, "deezer", "12", null);
});
it("does not hide storage/ownership failures as provider failure", async () => {
  m.persist.mockRejectedValue(new Error("ownership"));
  await expect(refreshLatestProvider(job, "deezer")).rejects.toThrow("ownership");
  expect(m.persist).toHaveBeenCalledTimes(1);
});

it("records oversized complete snapshots as failed coverage without losing the previous snapshot", async () => {
  m.fetch.mockResolvedValue([{ card: { title: "x".repeat(400001) } }]);
  expect(await refreshLatestProvider(job, "deezer")).toEqual({ status: "failed" });
  expect(m.persist).toHaveBeenCalledWith(job, "deezer", "12", null);
});

it("logs only provider and fixed diagnostic fields, never credentials or raw errors", async () => {
  const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    m.fetch.mockRejectedValue(
      Object.assign(new Error("token=SECRET https://private.example"), {
        latestPhase: "request",
        latestCode: "http_error",
        status: 403,
        body: "SECRET",
      }),
    );
    await refreshLatestProvider(job, "deezer");
    expect(log).toHaveBeenCalledWith("[latest/provider]", {
      provider: "deezer",
      phase: "request",
      code: "http_error",
      httpStatus: 403,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET");
    expect(JSON.stringify(log.mock.calls)).not.toContain("https://");
  } finally {
    log.mockRestore();
  }
});
