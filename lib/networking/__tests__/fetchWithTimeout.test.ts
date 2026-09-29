import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithTimeout } from "@/lib/networking/fetchWithTimeout";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchWithTimeout", () => {
  it("passes the request through with an abort signal", async () => {
    const res = new Response("ok");
    const fetchMock = vi.fn(async () => res);
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchWithTimeout("https://a.example", { method: "POST" }, 1000)).toBe(res);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://a.example");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns null on a network error instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      }),
    );
    expect(await fetchWithTimeout("https://a.example", {}, 1000)).toBeNull();
  });

  it("aborts after the timeout and returns null", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) =>
            init.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
          ),
      ),
    );
    const pending = fetchWithTimeout("https://a.example", {}, 4000);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await pending).toBeNull();
  });
});
