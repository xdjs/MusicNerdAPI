import { beforeEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { handleInterviewResponse } from "../handleInterviewResponse";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
  versions: vi.fn(),
  revise: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("../listInterviewResponses", () => ({ listInterviewResponses: m.list }));
vi.mock("../readInterviewResponse", () => ({ readInterviewResponse: m.read }));
vi.mock("../listInterviewResponseVersions", () => ({ listInterviewResponseVersions: m.versions }));
vi.mock("../reviseInterviewResponse", () => ({ reviseInterviewResponse: m.revise }));
const artist = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  answer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "verified" });
  for (const fn of [m.list, m.read, m.versions, m.revise]) fn.mockResolvedValue({ status: "ok" });
});
it("derives the caller from auth and uses non-cacheable CORS responses", async () => {
  const result = await handleInterviewResponse(
    new Request("https://example.org?limit=2"),
    artist,
    "list",
  );
  expect(m.list).toHaveBeenCalledWith(artist, "verified", { limit: 2 });
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(result.headers.get("access-control-allow-origin")).toBe("*");
  await handleInterviewResponse(new Request("https://example.org"), artist, "read", answer);
  expect(m.read).toHaveBeenCalledWith(artist, "verified", answer, {});
  await handleInterviewResponse(new Request("https://example.org"), artist, "versions", answer);
  expect(m.versions).toHaveBeenCalledWith(artist, "verified", answer, { limit: 10 });
});
it("does not access storage anonymously or after invalid input", async () => {
  expect(
    (
      await handleInterviewResponse(
        new Request("https://example.org?userId=forged"),
        artist,
        "list",
      )
    ).status,
  ).toBe(400);
  m.auth.mockResolvedValue(NextResponse.json({ status: "error" }, { status: 401 }));
  expect(
    (await handleInterviewResponse(new Request("https://example.org"), artist, "list")).status,
  ).toBe(401);
  expect(m.list).not.toHaveBeenCalled();
});
it("accepts bounded JSON edits and rejects malformed or oversized streamed bodies", async () => {
  const edit = { expectedRevision: "a".repeat(64), answer: "  Exact words.  " };
  const request = (body: string) =>
    new Request("https://example.org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
  expect(
    (await handleInterviewResponse(request(JSON.stringify(edit)), artist, "revise", answer)).status,
  ).toBe(200);
  expect(m.revise).toHaveBeenCalledWith(artist, "verified", answer, edit);
  m.revise.mockClear();
  expect((await handleInterviewResponse(request("{broken"), artist, "revise", answer)).status).toBe(
    400,
  );
  expect(
    (await handleInterviewResponse(request(" ".repeat(20001)), artist, "revise", answer)).status,
  ).toBe(413);
  expect(m.revise).not.toHaveBeenCalled();
});
it("does not leak auth or storage exceptions", async () => {
  m.list.mockRejectedValue(new Error("private database URL"));
  const result = await handleInterviewResponse(new Request("https://example.org"), artist, "list");
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain("private database");
});
