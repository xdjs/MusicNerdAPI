import { describe, it, expect, vi, beforeEach } from "vitest";

const { storageFetch } = vi.hoisted(() => ({ storageFetch: vi.fn() }));
vi.mock("@/lib/storage/storageFetch", () => ({ storageFetch }));
const { listProfileImages } = await import("@/lib/artistImages/listProfileImages");

beforeEach(() => {
  storageFetch.mockReset();
});

describe("listProfileImages", () => {
  it("lists the profile-images folder searching for the artist prefix", async () => {
    storageFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ name: "a_1.png", created_at: "2026-10-21T00:00:00Z" }])),
    );
    expect(await listProfileImages("a")).toEqual([
      { name: "a_1.png", created_at: "2026-10-21T00:00:00Z" },
    ]);
    const [path, init] = storageFetch.mock.calls[0];
    expect(path).toBe("object/list/vault-files");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      prefix: "profile-images",
      limit: 1000,
      offset: 0,
      search: "a_",
      sortBy: { column: "name", order: "asc" },
    });
  });

  it("keeps only entries with a name, and is empty for a non-array body", async () => {
    storageFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ name: "ok" }, { id: 1 }, null])),
    );
    expect(await listProfileImages("a")).toEqual([{ name: "ok" }]);
    storageFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: "x" })));
    expect(await listProfileImages("a")).toEqual([]);
  });

  it("throws when storage refuses", async () => {
    storageFetch.mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(listProfileImages("a")).rejects.toThrow("Storage list failed: HTTP 500");
  });
});
