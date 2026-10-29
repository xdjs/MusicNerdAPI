import { describe, expect, it } from "vitest";
import { validateArtistActivityQuery } from "@/lib/adminActivity/validateArtistActivityQuery";

const request = (query: string) =>
  new Request(`https://api.musicnerd.test/api/admin/activity${query}`);
const event = "20000000-0000-4000-8000-000000000001";

describe("validateArtistActivityQuery", () => {
  it("reads query, action, eventId and page", () => {
    expect(
      validateArtistActivityQuery(
        request(`?query=%20dutch%20&action=source_added&eventId=${event}&page=3`),
      ),
    ).toEqual({ query: "dutch", action: "source_added", eventId: event, page: 3 });
  });

  it("defaults to everything on page 1", () => {
    expect(validateArtistActivityQuery(request(""))).toEqual({
      query: "",
      action: "",
      eventId: "",
      page: 1,
    });
  });

  it("ignores an eventId that isn't a UUID and cuts long values, as MusicNerdWeb did", () => {
    const parsed = validateArtistActivityQuery(
      request(`?eventId=nope&action=${"a".repeat(80)}&query=${"q".repeat(150)}&page=-2`),
    );
    expect(parsed).toEqual({
      query: "q".repeat(100),
      action: "a".repeat(60),
      eventId: "",
      page: 1,
    });
  });
});
