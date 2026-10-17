import { expect, it } from "vitest";
import { describeInstagramCollection } from "../describeInstagramCollection";
import type { SocialPostInsert } from "../types";
const scan = {
  startedAt: "2026-10-17T00:00:00Z",
  reference: {
    observedAt: "2026-10-16T00:00:00Z",
    gapSince: null,
    anchors: [{ id: "old", postedAt: "2026-09-02T00:00:00Z" }],
  },
};
const row = (id = "old", postedAt = "2026-09-02T00:00:00Z", raw = {}) =>
  ({ platformPostId: id, postedAt, isOwnPost: true, raw }) as SocialPostInsert;
it("recognizes an unchanged readable feed with matching anchors", () =>
  expect(describeInstagramCollection([row()], scan).noNewPosts).toBe(true));
it.each(
  [
    [],
    [row("different")],
    [row("old", "2026-09-02T00:00:00Z", { isPinned: true })],
    [row(), row("new", "2026-10-16T12:00:00Z")],
  ].map(rows => [rows]),
)("does not claim no-new-posts from empty, missing anchors, pinned-only, or new posts", rows =>
  expect(describeInstagramCollection(rows, scan).noNewPosts).toBe(false),
);
it("does not certify a first bounded import", () =>
  expect(describeInstagramCollection([row()]).noNewPosts).toBe(false));
