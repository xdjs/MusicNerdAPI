import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getArtistKnowledgeHandler } from "@/lib/knowledge/getArtistKnowledgeHandler";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { artistId, rawKnowledge, vault } from "./fixtures";

const mock = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/knowledge/loadArtistKnowledge", () => ({ loadArtistKnowledge: mock.load }));
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "verified-caller" });
  mock.load.mockResolvedValue(normalizeArtistKnowledge({ ...rawKnowledge, vault: [vault] }));
});

describe("getArtistKnowledgeHandler", () => {
  it("binds storage access to verified auth and returns private, non-cacheable evidence", async () => {
    const response = await getArtistKnowledgeHandler(
      new Request("https://example.org"),
      artistId,
      "sources",
    );
    expect(response.status).toBe(200);
    expect(mock.load).toHaveBeenCalledWith(artistId, "verified-caller");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(await response.json()).toMatchObject({
      status: "ok",
      sources: [{ sourceId: `vault:${vault.id}` }],
    });
  });
  it("rejects invalid input and unauthorized requests without reading private storage", async () => {
    expect(
      (
        await getArtistKnowledgeHandler(
          new Request("https://example.org?accountId=other"),
          artistId,
          "brief",
        )
      ).status,
    ).toBe(400);
    expect(mock.auth).not.toHaveBeenCalled();
    mock.auth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const response = await getArtistKnowledgeHandler(
      new Request("https://example.org"),
      artistId,
      "brief",
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthenticated" });
    expect(mock.load).not.toHaveBeenCalled();
  });
  it("distinguishes access revocation and storage outages without leaking errors or empty successes", async () => {
    mock.load.mockRejectedValue(
      new KnowledgeError("forbidden", 403, "Artist claimant or administrator required"),
    );
    expect(
      (await getArtistKnowledgeHandler(new Request("https://example.org"), artistId, "history"))
        .status,
    ).toBe(403);
    mock.load.mockRejectedValue(new Error("postgres://private-credentials provider payload"));
    const response = await getArtistKnowledgeHandler(
      new Request("https://example.org"),
      artistId,
      "history",
    );
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain("storage_unavailable");
    expect(body).not.toContain("private-credentials");
    expect(body).not.toContain("entries");
  });
  it("treats authentication storage failure as unavailable, not unauthenticated", async () => {
    mock.auth.mockRejectedValue(new Error("db outage"));
    expect(
      (await getArtistKnowledgeHandler(new Request("https://example.org"), artistId, "brief"))
        .status,
    ).toBe(503);
    expect(mock.load).not.toHaveBeenCalled();
  });
});
