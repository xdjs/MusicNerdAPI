import { expect, it } from "vitest";
import { vaultSourceRevision } from "../vaultSourceRevision";
it.each(["publication", "activityId", "origin", "id"])(
  "invalidates changed %s provenance",
  field => {
    const source = {
      url: "https://example.org",
      extractedText: "Evidence",
      publication: "inherit",
      activityId: "event",
      origin: "submission",
      id: "source",
    };
    expect(vaultSourceRevision({ ...source, [field]: "changed" })).not.toBe(
      vaultSourceRevision(source),
    );
  },
);
