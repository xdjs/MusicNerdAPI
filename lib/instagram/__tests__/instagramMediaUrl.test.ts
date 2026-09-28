import { describe, it, expect } from "vitest";
import { instagramMediaUrl } from "@/lib/instagram/instagramMediaUrl";

describe("instagramMediaUrl", () => {
  it.each([
    "http://scontent.cdninstagram.com/a",
    "https://cdninstagram.com.evil.test/a",
    "https://127.0.0.1/a",
    "https://a.fbcdn.net:444/a",
    "https://user:pass@a.fbcdn.net/a",
    42,
  ])("rejects unsafe media URL %s", value => {
    expect(instagramMediaUrl(value)).toBeNull();
  });

  it("accepts Instagram's media hosts", () => {
    expect(instagramMediaUrl("https://scontent.cdninstagram.com/p.jpg")).toBe(
      "https://scontent.cdninstagram.com/p.jpg",
    );
    expect(instagramMediaUrl("https://b.fbcdn.net/c.jpg")).toBe("https://b.fbcdn.net/c.jpg");
  });
});
