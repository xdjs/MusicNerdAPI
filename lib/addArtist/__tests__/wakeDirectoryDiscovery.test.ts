import { describe, it, expect, vi, beforeEach } from "vitest";
import { wakeDirectoryDiscovery } from "@/lib/addArtist/wakeDirectoryDiscovery";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("wakeDirectoryDiscovery", () => {
  it("asks this API to run the artist's directory research now", async () => {
    fetchMock.mockResolvedValue(Response.json({ status: "ok", ran: true }));
    expect(await wakeDirectoryDiscovery("https://api.test", "a1")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/research/advance");
    expect(JSON.parse(init.body)).toEqual({ artistId: "a1", kinds: ["source_search"] });
  });

  it("is false when nothing ran or the call failed", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ status: "ok", ran: false }));
    expect(await wakeDirectoryDiscovery("https://api.test", "a1")).toBe(false);
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    expect(await wakeDirectoryDiscovery("https://api.test", "a1")).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("down"));
    expect(await wakeDirectoryDiscovery("https://api.test", "a1")).toBe(false);
  });
});
