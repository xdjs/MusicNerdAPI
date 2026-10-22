import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAllMcpKeys } from "@/lib/mcpKeys/getAllMcpKeys";

const mock = vi.hoisted(() => ({ orderBy: vi.fn(), from: vi.fn(), select: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { select: mock.select } }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.select.mockReturnValue({ from: mock.from });
  mock.from.mockReturnValue({ orderBy: mock.orderBy });
});

describe("getAllMcpKeys", () => {
  it("exposes only the first 8 characters of each hash", async () => {
    mock.orderBy.mockResolvedValueOnce([
      {
        id: "k1",
        label: "mapping-worker",
        keyHash: "5b9720ab1f0e4c7d9a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f7081",
        createdAt: "2026-03-10 09:00:00+00",
        revokedAt: null,
      },
      {
        id: "k2",
        label: "e2e-test",
        keyHash: "a6209a5d1f0e4c7d9a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f7081",
        createdAt: "2026-03-11 18:50:12+00",
        revokedAt: "2026-03-11 18:58:56+00",
      },
    ]);
    expect(await getAllMcpKeys()).toEqual([
      {
        id: "k1",
        label: "mapping-worker",
        keyHashPrefix: "5b9720ab",
        createdAt: "2026-03-10 09:00:00+00",
        revokedAt: null,
      },
      {
        id: "k2",
        label: "e2e-test",
        keyHashPrefix: "a6209a5d",
        createdAt: "2026-03-11 18:50:12+00",
        revokedAt: "2026-03-11 18:58:56+00",
      },
    ]);
  });

  it("is empty when there are no keys", async () => {
    mock.orderBy.mockResolvedValueOnce([]);
    expect(await getAllMcpKeys()).toEqual([]);
  });
});
