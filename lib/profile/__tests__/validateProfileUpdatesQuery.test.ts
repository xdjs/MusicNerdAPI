import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateProfileUpdatesQuery } from "@/lib/profile/validateProfileUpdatesQuery";

const request = (query: string) => new Request(`https://x/api/profile/updates${query}`);

describe("validateProfileUpdatesQuery", () => {
  it("defaults to offset 0 and All", () => {
    expect(validateProfileUpdatesQuery(request(""))).toEqual({ offset: 0, filter: "All" });
  });

  it.each(["All", "Release", "Socials", "Lore", "Instagram", "Interview", "In-Process"])(
    "accepts the %s filter",
    filter => {
      expect(validateProfileUpdatesQuery(request(`?offset=6&kind=${filter}`))).toEqual({
        offset: 6,
        filter,
      });
    },
  );

  it("is 400 Invalid offset for a bad offset", async () => {
    const res = validateProfileUpdatesQuery(request("?offset=x")) as NextResponse;
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid offset" });
  });

  it.each(["Everything", "toString", "all"])("is 400 Invalid filter for %s", async kind => {
    const res = validateProfileUpdatesQuery(request(`?kind=${kind}`)) as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid filter" });
  });
});
