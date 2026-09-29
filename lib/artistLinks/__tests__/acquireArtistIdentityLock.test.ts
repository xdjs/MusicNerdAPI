import { describe, it, expect, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { acquireArtistIdentityLock } from "@/lib/artistLinks/acquireArtistIdentityLock";

describe("acquireArtistIdentityLock", () => {
  it("takes a transaction-scoped advisory lock on the hashed key", async () => {
    const execute = vi.fn(async (_q: SQL) => []);
    await acquireArtistIdentityLock({ execute } as never, "k");
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toBe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))");
    expect(params).toEqual(["k"]);
  });
});
