import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), exec: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.exec } }));
const { postNamePromptHandler } = await import(
  "@/lib/user/postNamePromptHandler"
);

const req = () => new Request("https://api/api/user/u1/name-prompt", { method: "POST" });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
});

describe("postNamePromptHandler", () => {
  it("returns showPrompt true when the row was updated", async () => {
    m.exec.mockResolvedValueOnce([{ id: "u1" }]);
    const res = await postNamePromptHandler(req(), "u1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ showPrompt: true });
  });

  it("returns showPrompt false when nothing was updated", async () => {
    m.exec.mockResolvedValueOnce([]);
    const res = await postNamePromptHandler(req(), "u1");
    expect(await res.json()).toMatchObject({ showPrompt: false });
  });

  it("returns 403 for a different user", async () => {
    const res = await postNamePromptHandler(req(), "u2");
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    m.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );
    const res = await postNamePromptHandler(req(), "u1");
    expect(res.status).toBe(401);
  });
});
