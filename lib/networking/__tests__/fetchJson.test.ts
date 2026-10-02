import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchJson } from "@/lib/networking/fetchJson";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchJson", () => {
  it("returns the parsed body, sending headers and a timeout signal", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ a: 1 }) }));
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await fetchJson("https://x/y", { headers: { Authorization: "Bearer t" }, timeoutMs: 4000 }),
    ).toEqual({ a: 1 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://x/y");
    expect(init.headers).toEqual({ Authorization: "Bearer t" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("is null for a non-2xx status, a network error or an unparseable body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    expect(await fetchJson("https://x", { timeoutMs: 10 })).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("net");
      }),
    );
    expect(await fetchJson("https://x", { timeoutMs: 10 })).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new Error("bad");
        },
      })),
    );
    expect(await fetchJson("https://x", { timeoutMs: 10 })).toBeNull();
  });
});
