import { beforeEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getInterviewBoundariesHandler } from "@/lib/interviewMemory/getInterviewBoundariesHandler";
import { GET } from "@/app/api/artist/[id]/interview/boundaries/route";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
const m = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/interviewMemory/loadInterviewBoundaries", () => ({
  loadInterviewBoundaries: m.load,
}));
vi.mock("@/lib/interviewMemory/postInterviewBoundaryHandler", () => ({
  postInterviewBoundaryHandler: vi.fn(),
}));
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ userId: "account" });
  m.load.mockResolvedValue({ status: "ok", sitting: 2, boundaries: [], nextCursor: null });
});
it("exposes the authenticated GET route with private, no-store pages", async () => {
  const response = await GET(new Request("https://api.example?sitting=2&cursor=next"), {
    params: Promise.resolve({ id }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(m.load).toHaveBeenCalledWith(id, "account", { sitting: 2, cursor: "next" });
});
it("rejects missing auth and unknown query controls before loading", async () => {
  m.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
  expect(
    (await getInterviewBoundariesHandler(new Request("https://api.example?sitting=2"), id)).status,
  ).toBe(401);
  expect(
    (
      await getInterviewBoundariesHandler(
        new Request("https://api.example?sitting=2&omit=true"),
        id,
      )
    ).status,
  ).toBe(400);
  expect(m.load).not.toHaveBeenCalled();
});
it.each([403, 409])(
  "preserves status %i and does not present failures as empty boundaries",
  async status => {
    m.load.mockRejectedValue(new KnowledgeError("changed", status, "Reload"));
    const response = await getInterviewBoundariesHandler(
      new Request("https://api.example?sitting=2"),
      id,
    );
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ status: "error", error: "Reload", code: "changed" });
  },
);
it("hides storage failure details", async () => {
  m.load.mockRejectedValue(new Error("private database failure"));
  const response = await getInterviewBoundariesHandler(
    new Request("https://api.example?sitting=2"),
    id,
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private database failure");
});
