import { expect, it } from "vitest";
import { classifyRevokedSource } from "@/lib/claims/classifyRevokedSource";

const source = { id: "s", artistId: "a", activityId: "e", origin: "upload" };
const event = {
  id: "e",
  artistId: "a",
  sourceId: "s",
  actorUserId: "u",
  actorKind: "user",
  action: "source_upload",
  trigger: "trusted_submission",
};

it("retains a trusted submission even when its actor is the revoked claimant", () => {
  expect(classifyRevokedSource(source, event, "u")).toBe("retain");
});

it.each(["id", "artistId", "sourceId", "action", "actorKind"])(
  "sends mismatched provenance to review: %s",
  key => {
    expect(classifyRevokedSource(source, { ...event, [key]: "wrong" }, "other")).toBe("review");
  },
);

it("does not infer trust from a missing event or actor", () => {
  expect(classifyRevokedSource(source, null, "u")).toBe("review");
  expect(classifyRevokedSource(source, { ...event, actorUserId: null }, "u")).toBe("review");
});

it("deletes the claimant's own content but sends someone else's untrusted content to review", () => {
  expect(classifyRevokedSource(source, { ...event, trigger: "dashboard" }, "u")).toBe("delete");
  expect(classifyRevokedSource(source, { ...event, trigger: "dashboard" }, "other")).toBe("review");
});

it("matches a submission to its own action", () => {
  const submission = { ...source, origin: "submission" };
  expect(
    classifyRevokedSource(submission, { ...event, action: "source_submission", trigger: "x" }, "u"),
  ).toBe("delete");
  expect(classifyRevokedSource(submission, { ...event, trigger: "x" }, "u")).toBe("review");
});

it("deletes research but sends contradictory trusted provenance to review", () => {
  expect(classifyRevokedSource({ ...source, origin: "research" }, null, "u")).toBe("delete");
  expect(classifyRevokedSource({ ...source, origin: "research" }, event, "u")).toBe("review");
});
