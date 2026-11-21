import { describe, expect, it } from "vitest";
import { getResourceMetadata } from "@/lib/oauth/getResourceMetadata";

describe("getResourceMetadata", () => {
  it("names /mcp on the request's origin and the authorization server under it", () => {
    expect(getResourceMetadata("https://api.musicnerd.net")).toEqual({
      resource: "https://api.musicnerd.net/mcp",
      authorization_servers: ["https://api.musicnerd.net/api/oauth"],
      scopes_supported: ["mcp:tools"],
      bearer_methods_supported: ["header"],
      resource_name: "Music Nerd",
    });
  });
});
