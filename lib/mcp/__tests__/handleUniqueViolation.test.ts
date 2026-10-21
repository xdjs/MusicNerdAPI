import { describe, it, expect } from "vitest";
import { handleUniqueViolation } from "@/lib/mcp/handleUniqueViolation";
import { MappingConcurrentWriteError } from "@/lib/mcp/MappingConcurrentWriteError";
import { MappingConflictError } from "@/lib/mcp/MappingConflictError";

describe("handleUniqueViolation", () => {
  it("turns the platform-id unique into a conflict with another artist", () => {
    expect(() =>
      handleUniqueViolation(
        { code: "23505", constraint_name: "artist_id_mappings_platform_id_uniq" },
        "deezer",
        "9",
      ),
    ).toThrow(
      new MappingConflictError("platformId 9 on deezer is already mapped to a different artist"),
    );
  });

  it("turns any other unique violation into a concurrent write, also when wrapped as cause", () => {
    expect(() =>
      handleUniqueViolation(
        { code: "23505", constraint: "artist_id_mappings_artist_platform_uniq" },
        "deezer",
        "9",
      ),
    ).toThrow(
      new MappingConcurrentWriteError(
        "A mapping for deezer already exists for this artist (concurrent write)",
      ),
    );
    expect(() =>
      handleUniqueViolation(
        Object.assign(new Error("w"), { cause: { code: "23505" } }),
        "tidal",
        "1",
      ),
    ).toThrow(MappingConcurrentWriteError);
  });

  it("rethrows anything else unchanged", () => {
    const err = new Error("connection reset");
    expect(() => handleUniqueViolation(err, "deezer", "9")).toThrow(err);
    expect(() => handleUniqueViolation({ code: "42P01" }, "deezer", "9")).toThrow();
  });
});
