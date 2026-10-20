import { it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
const auth = vi.hoisted(() => vi.fn());
const start = vi.hoisted(() => vi.fn());
const read = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({ validateArtistEditRequest: auth }));
vi.mock("../requestEditorSourceSearch", () => ({ requestEditorSourceSearch: start }));
vi.mock("../getEditorSourceSearch", () => ({ getEditorSourceSearch: read }));
const { editorSourceSearchHandler } = await import("../editorSourceSearchHandler");
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ artistId: id, userId: "user" });
});
it("rejects invalid or extra request input before queueing", async () => {
  for (const body of [{}, { requestId: "bad" }, { requestId: id, userId: "forged" }]) {
    expect(
      (
        await editorSourceSearchHandler(
          new Request("https://example.test", { method: "POST", body: JSON.stringify(body) }),
          id,
        )
      ).status,
    ).toBe(400);
  }
  expect(start).not.toHaveBeenCalled();
});
it("honors auth denial and does not leak database failures", async () => {
  auth.mockResolvedValueOnce(NextResponse.json({ status: "error" }, { status: 403 }));
  expect((await editorSourceSearchHandler(new Request("https://example.test"), id)).status).toBe(
    403,
  );
  start.mockRejectedValue(new Error("secret database failure"));
  const r = await editorSourceSearchHandler(
    new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ requestId: id }),
    }),
    id,
  );
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("secret");
});
it("GET reads only; POST passes authenticated requester", async () => {
  read.mockResolvedValue({ status: "ok", phase: "done" });
  start.mockResolvedValue({ status: "ok", phase: "pending" });
  expect(
    (await editorSourceSearchHandler(new Request(`https://example.test?requestId=${id}`), id))
      .status,
  ).toBe(200);
  expect(start).not.toHaveBeenCalled();
  await editorSourceSearchHandler(
    new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ requestId: id }),
    }),
    id,
  );
  expect(start).toHaveBeenCalledWith(id, "user", id);
});
