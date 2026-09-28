import { describe, it, expect } from "vitest";
import { isJobThumbnailPath } from "@/lib/instagram/isJobThumbnailPath";

const prefix = "artist/instagram-job-";

describe("isJobThumbnailPath", () => {
  it("accepts a path this job generated", () => {
    expect(isJobThumbnailPath(`${prefix}123-${"a".repeat(64)}.webp`, prefix)).toBe(true);
  });

  it("rejects anything outside the job or not in the generated shape", () => {
    expect(isJobThumbnailPath("other/file.webp", prefix)).toBe(false);
    expect(isJobThumbnailPath(`${prefix}123-short.webp`, prefix)).toBe(false);
    expect(isJobThumbnailPath(`${prefix}../../etc-${"a".repeat(64)}.webp`, prefix)).toBe(false);
  });
});
