import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSourceText } from "@/lib/sourceExtraction/fetchSourceText";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:http", () => ({ request: mocks.request }));
vi.mock("node:https", () => ({ request: mocks.request }));
function response(
  status: number,
  body: string,
  headers: Record<string, string> = { "content-type": "text/html" },
) {
  mocks.request.mockImplementationOnce((_url, options, cb) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
    req.destroy = vi.fn();
    req.end = () =>
      queueMicrotask(() =>
        cb(Object.assign(Readable.from([Buffer.from(body)]), { statusCode: status, headers })),
      );
    expect(options.agent).toBe(false);
    return req;
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});
describe("fetchSourceText", () => {
  it("stores original article text and pins DNS for the connection", async () => {
    response(
      200,
      "<article><p>Original words about a record, with the qualification that this was a demo.</p></article>",
    );
    const r = await fetchSourceText("https://artist.example/interview", 2000);
    expect(r.status).toBe("ready");
    expect(r.text).toContain("this was a demo.");
    const lookup = mocks.request.mock.calls[0][1].lookup;
    const cb = vi.fn();
    lookup("artist.example", { all: true }, cb);
    expect(cb).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
  });
  it.each([
    "http://127.0.0.1/",
    "http://[::ffff:127.0.0.1]/",
    "file:///secret",
    "https://user:pass@artist.example",
    "https://artist.example:8443/",
  ])("does not request %s", async url => {
    expect((await fetchSourceText(url, 2000)).status).toBe("blocked");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("rejects a DNS answer containing a private destination", async () => {
    mocks.lookup.mockResolvedValue([{ address: "10.0.0.1", family: 4 }]);
    expect((await fetchSourceText("https://artist.example", 2000)).status).toBe("blocked");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("rechecks redirected destinations", async () => {
    response(302, "", { location: "http://169.254.169.254/latest" });
    expect((await fetchSourceText("https://artist.example", 2000)).status).toBe("blocked");
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("records blocked responses without storing challenge text", async () => {
    response(403, "<body>Verify your browser</body>");
    const r = await fetchSourceText("https://artist.example", 2000);
    expect(r.status).toBe("blocked");
    expect(r.httpStatus).toBe(403);
    expect(r.text).toBeUndefined();
  });
  it("does not call title/description or script content original text", async () => {
    response(200, "<title>Unsupported headline</title><script>Biography</script>");
    expect((await fetchSourceText("https://artist.example", 2000)).status).toBe("empty");
  });
  it("refuses PDFs and oversized responses without partial evidence", async () => {
    response(200, "%PDF", { "content-type": "application/pdf" });
    expect((await fetchSourceText("https://artist.example", 2000)).status).toBe("unsupported");
    response(200, "x".repeat(2 * 1024 * 1024 + 1));
    expect((await fetchSourceText("https://artist.example", 2000)).status).toBe("too_large");
  });
  it("times out DNS without a request", async () => {
    mocks.lookup.mockReturnValue(new Promise(() => {}));
    expect((await fetchSourceText("https://artist.example", 10)).status).toBe("unavailable");
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
