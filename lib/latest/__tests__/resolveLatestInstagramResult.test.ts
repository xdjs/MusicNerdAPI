import { expect, it, vi } from "vitest";
import type { ResearchJob } from "@/lib/research/types";
import { resolveLatestInstagramResult } from "../resolveLatestInstagramResult";
const store = vi.hoisted(() => vi.fn());
vi.mock("../latestRefreshStore", () => ({ latestRefreshStore: store }));
it("clears a previous failure and records the excluded date window after recovery", async () => {
  const job = {
    state: {
      instagramVerification: { after: "2026-09-17T00:00:00Z" },
      instagramFailure: { reason: "old failure" },
    },
  } as unknown as ResearchJob;
  expect(
    await resolveLatestInstagramResult(job, {
      ingested: 3,
      ownPosts: 3,
      collabPosts: 0,
      newestPostAt: "2026-09-02T00:00:00Z",
    }),
  ).toMatchObject({ status: "checked", detail: "older_posts_found" });
  expect(job.state.instagramFailure).toBeUndefined();
  expect(job.state.instagramObservation).toMatchObject({
    after: "2026-09-17T00:00:00Z",
    outcome: "older_posts_found",
  });
});
it("keeps an unreadable initial account a failure without starting a verification", async () => {
  const job = {
    state: { runId: "initial", datasetId: "ds", scan: { startedAt: "2026-10-17T00:00:00Z" } },
  } as unknown as ResearchJob;
  expect(
    await resolveLatestInstagramResult(job, {
      ingested: 0,
      ownPosts: 0,
      collabPosts: 0,
      providerError: "no_items",
    }),
  ).toMatchObject({ status: "failed", detail: "instagram_unavailable" });
  expect(job.state.runId).toBe("initial");
  expect(job.state.instagramVerification).toBeUndefined();
});
