import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchPageContent } from "@/lib/pages/fetchPageContent";

afterEach(() => vi.unstubAllGlobals());

const respond = (body: string, status = 200, url = "") =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ url, status, ok: status >= 200 && status < 300, text: async () => body })),
  );

describe("fetchPageContent", () => {
  it("never fetches an unsafe URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchPageContent("http://169.254.169.254/")).toEqual({
      title: "Untitled Source",
      extractedText: null,
      status: null,
      failure: "network",
      publishedAt: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([200, 403])("keeps the final redirect URL for an HTTP %s response", async status => {
    const finalUrl = "https://www.linkedin.com/in/namesake";
    respond("<html><title>Namesake</title><body>Public profile</body></html>", status, finalUrl);
    const result = await fetchPageContent("https://example.org/redirect");
    expect(result.resolvedUrl).toBe(finalUrl);
    expect(result.status).toBe(status);
  });

  it("reads title, snippet, og:image, date, links and body text, with the bot UA", async () => {
    const text = "Artist-supplied professional biography. ".repeat(20);
    const html = `<html><head><title>Artist &amp; bio</title>
      <meta name="description" content="About the artist">
      <meta property="og:image" content="https://i.example/a.jpg">
      <meta property="article:published_time" content="2019-01-10"></head>
      <body><article><p>${text}</p></article>
      <a href="/music/one/piece.html">p</a><a href="https://instagram.com/artist">ig</a></body></html>`;
    const fetchMock = vi.fn(async () => ({
      url: "",
      status: 200,
      ok: true,
      text: async () => html,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchPageContent("https://artist.example/bio");
    expect(r.title).toBe("Artist & bio");
    expect(r.snippet).toBe("About the artist");
    expect(r.ogImage).toBe("https://i.example/a.jpg");
    expect(r.publishedAt).toBe("2019-01-10");
    expect(r.links).toEqual(["https://artist.example/music/one/piece.html"]);
    expect(r.outboundLinks).toEqual(["https://instagram.com/artist"]);
    expect(r.extractedText).toContain("Artist-supplied");
    expect(r.fullText).toBe(r.extractedText);
    expect(r.resolvedUrl).toBe("https://artist.example/bio");
    expect(r.podcastEpisode).toBeNull();
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toEqual({ "User-Agent": "MusicNerdBot/1.0" });
  });

  it("caps stored text at 50,000 characters but keeps the full text for verification", async () => {
    const long = "word ".repeat(15_000);
    respond(`<html><body><p>${long}</p></body></html>`);
    const r = await fetchPageContent("https://a.example/x");
    expect(r.extractedText).toHaveLength(50_000);
    expect(r.fullText!.length).toBeGreaterThan(50_000);
  });

  it("stores no text for a near-empty body, and a host fallback title", async () => {
    respond("<html><body><p>short</p></body></html>");
    const r = await fetchPageContent("https://www.a.example/x");
    expect(r.extractedText).toBeNull();
    expect(r.title).toBe("Source from a.example");
  });

  it("records why a request never completed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw Object.assign(new Error("fetch failed"), { cause: { code: "ENOTFOUND" } });
      }),
    );
    const r = await fetchPageContent("https://invented.example/x");
    expect(r.status).toBeNull();
    expect(r.failure).toBe("dns");
  });
});
