import { describe, it, expect } from "vitest";
import { BioConflictError } from "@/lib/bio/BioConflictError";

describe("BioConflictError", () => {
  it("carries MusicNerdWeb's user-facing message and name", () => {
    const e = new BioConflictError();
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("BioConflictError");
    expect(e.message).toBe(
      "Your bio changed or was pinned while generation was running. Your current bio is safe; review it before trying again.",
    );
  });
});
