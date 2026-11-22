import { describe, it, expect } from "vitest";
import { getMcpServerInfo } from "@/lib/mcp/getMcpServerInfo";

describe("getMcpServerInfo", () => {
  it("names the server and points its icon at the disc on the origin serving the request", () => {
    expect(getMcpServerInfo("https://api.musicnerd.net")).toEqual({
      name: "Music Nerd",
      version: "1.0.0",
      icons: [
        { src: "https://api.musicnerd.net/icon.png", mimeType: "image/png", sizes: ["512x512"] },
      ],
    });
  });

  it("follows the host, so a preview serves its own icon", () => {
    expect(getMcpServerInfo("https://api-git-branch-musicnerd.vercel.app").icons?.[0]?.src).toBe(
      "https://api-git-branch-musicnerd.vercel.app/icon.png",
    );
  });
});
