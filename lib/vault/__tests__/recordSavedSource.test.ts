import { describe, it, expect, vi } from "vitest";
import { recordSavedSource } from "@/lib/vault/recordSavedSource";
import { searchRun } from "@/lib/vault/__tests__/searchRun";

const source = { id: "s1", url: "https://example.com/a" } as never;

describe("recordSavedSource", () => {
  it("keeps the source and tells the listener", () => {
    const onSaved = vi.fn();
    const run = searchRun({ onSaved });
    recordSavedSource(run, source);
    expect(run.saved).toEqual([source]);
    expect(onSaved).toHaveBeenCalledWith(source);
  });

  it("never loses a source to a listener that throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = searchRun({
      onSaved: () => {
        throw new Error("view gone");
      },
    });
    recordSavedSource(run, source);
    expect(run.saved).toEqual([source]);
    error.mockRestore();
  });

  it("works without a listener", () => {
    const run = searchRun();
    recordSavedSource(run, source);
    expect(run.saved).toEqual([source]);
  });
});
