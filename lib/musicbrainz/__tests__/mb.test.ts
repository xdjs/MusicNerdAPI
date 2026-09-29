import { describe, it, expect, vi } from "vitest";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/musicbrainz/requestMusicBrainz", () => ({ requestMusicBrainz: request }));
const { mb } = await import("@/lib/musicbrainz/mb");

describe("mb", () => {
  it("returns the data of an ok response and null otherwise", async () => {
    request.mockResolvedValueOnce({ status: "ok", data: { a: 1 } });
    expect(await mb("/x", 100)).toEqual({ a: 1 });
    expect(request).toHaveBeenCalledWith("/x", 100);
    request.mockResolvedValueOnce({ status: "not-found" });
    expect(await mb("/x")).toBeNull();
  });
});
