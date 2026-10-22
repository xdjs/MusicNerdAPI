import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkLinkPage } from "@/lib/validateLink/checkLinkPage";
import { VALIDATED_PLATFORMS } from "@/lib/validateLink/const";

const platform = (name: string) => VALIDATED_PLATFORMS.find(p => p.name === name)!;
const fetchMock = vi.fn();
function page(status: number, text: string, url = "https://soundcloud.com/pete") {
  const response = new Response(text, { status });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("checkLinkPage", () => {
  it("is valid for a 200 page without an error phrase", async () => {
    fetchMock.mockResolvedValue(page(200, "<title>Pete</title>"));
    expect(await checkLinkPage("https://soundcloud.com/pete", platform("soundcloud"))).toEqual({
      valid: true,
    });
    expect(fetchMock).toHaveBeenCalledWith("https://soundcloud.com/pete", { method: "GET" });
  });

  it("is invalid on a 404", async () => {
    fetchMock.mockResolvedValue(page(404, ""));
    expect(await checkLinkPage("https://zora.co/x", platform("zora"))).toEqual({
      valid: false,
      reason: "404 Not Found",
    });
  });

  it("is invalid on SoundCloud's /404 redirect", async () => {
    fetchMock.mockResolvedValue(page(200, "", "https://soundcloud.com/404"));
    expect(await checkLinkPage("https://soundcloud.com/x", platform("soundcloud"))).toEqual({
      valid: false,
      reason: "soundcloud 404 redirect",
    });
  });

  it("is invalid when the page shows a not-found phrase, case-insensitively", async () => {
    fetchMock.mockResolvedValue(page(200, "sorry, THAT SOMETHING isn't here."));
    expect(await checkLinkPage("https://x.bandcamp.com", platform("bandcamp"))).toEqual({
      valid: false,
      reason: "bandcamp error page",
    });
  });

  it("treats other statuses as valid and a network failure as invalid", async () => {
    fetchMock.mockResolvedValueOnce(page(403, "This page could not be found"));
    expect(await checkLinkPage("https://mintsongs.com/x", platform("mintsongs"))).toEqual({
      valid: true,
    });
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await checkLinkPage("https://mintsongs.com/x", platform("mintsongs"))).toEqual({
      valid: false,
      reason: "Network error or invalid URL",
    });
  });
});
