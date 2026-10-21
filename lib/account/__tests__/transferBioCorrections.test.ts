import { describe, it, expect, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { transferBioCorrections } from "@/lib/account/transferBioCorrections";

describe("transferBioCorrections", () => {
  it("re-points authored and reviewed corrections in one statement", async () => {
    const execute = vi.fn(async (_query: SQL) => []);
    await transferBioCorrections({ execute } as never, "from", "to");
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toBe(
      "update artist_bio_corrections set user_id=case when user_id=$1::uuid then $2::uuid else user_id end, reviewed_by=case when reviewed_by=$3::uuid then $4::uuid else reviewed_by end where user_id=$5::uuid or reviewed_by=$6::uuid",
    );
    expect(params).toEqual(["from", "to", "from", "to", "from", "from"]);
  });
});
