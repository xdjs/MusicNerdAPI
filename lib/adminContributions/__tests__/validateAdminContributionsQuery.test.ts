import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateAdminContributionsQuery } from "@/lib/adminContributions/validateAdminContributionsQuery";

const request = (query: string) =>
  new Request(`https://api.musicnerd.test/api/admin/contributions${query}`);
const user = "00000000-0000-4000-8000-000000000010";

describe("validateAdminContributionsQuery", () => {
  it("reads every filter", () => {
    expect(
      validateAdminContributionsQuery(
        request(
          `?userId=${user}&query=%20dutch%20&origin=research&type=upload&status=approved&page=2`,
        ),
      ),
    ).toEqual({
      userId: user,
      query: "dutch",
      origin: "research",
      type: "upload",
      status: "approved",
      page: 2,
    });
  });

  it("defaults to pending across everyone", () => {
    expect(validateAdminContributionsQuery(request(""))).toEqual({
      userId: "",
      query: "",
      origin: "",
      type: "",
      status: "pending",
      page: 1,
    });
  });

  it("defaults to every status for one contributor", () => {
    expect(validateAdminContributionsQuery(request(`?userId=${user}`))).toMatchObject({
      status: "all",
    });
  });

  it("drops unknown origins, types and statuses, as MusicNerdWeb did", () => {
    expect(
      validateAdminContributionsQuery(request("?origin=bot&type=video&status=weird&page=x")),
    ).toEqual({ userId: "", query: "", origin: "", type: "", status: "pending", page: 1 });
  });

  it("rejects a userId that isn't a UUID", async () => {
    const res = validateAdminContributionsQuery(request("?userId=nope"));
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    expect(await (res as NextResponse).json()).toEqual({
      status: "error",
      error: "Invalid user ID",
    });
  });
});
