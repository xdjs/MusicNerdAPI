import { describe, it, expect } from "vitest";
import { isUnsafeUrl } from "@/lib/pages/isUnsafeUrl";

describe("isUnsafeUrl", () => {
  it("allows normal http(s) URLs", () => {
    expect(isUnsafeUrl("https://pitchfork.com/reviews/example")).toBe(false);
    expect(isUnsafeUrl("http://example.com")).toBe(false);
  });

  it("blocks localhost, private ranges and cloud metadata", () => {
    for (const url of [
      "http://localhost:3000/api/admin",
      "http://127.0.0.1/secret",
      "http://0.0.0.0:8080",
      "http://[::1]/api",
      "http://10.0.0.1/internal",
      "http://172.16.0.1/internal",
      "http://172.31.255.255/internal",
      "http://192.168.1.1/router",
      "http://169.254.169.254/latest/meta-data/",
    ])
      expect(isUnsafeUrl(url)).toBe(true);
  });

  it("blocks non-http protocols and malformed URLs", () => {
    for (const url of [
      "ftp://example.com/file",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "not-a-url",
      "",
    ])
      expect(isUnsafeUrl(url)).toBe(true);
  });

  it("allows public 172.x outside the private range", () => {
    expect(isUnsafeUrl("http://172.15.0.1/ok")).toBe(false);
    expect(isUnsafeUrl("http://172.32.0.1/ok")).toBe(false);
  });

  it("blocks IPv6 unique-local, link-local and site-local", () => {
    for (const url of [
      "http://[fc00::1]/",
      "http://[fd12::1]/",
      "http://[fe80::1]/",
      "http://[fe81::1]/",
      "http://[febf::1]/",
      "http://[fec0::1]/",
      "http://[feff::1]/",
    ])
      expect(isUnsafeUrl(url)).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 private addresses and allows public ones", () => {
    for (const url of [
      "http://[::ffff:127.0.0.1]/",
      "http://[::ffff:10.0.0.1]/",
      "http://[::ffff:192.168.1.1]/",
      "http://[::ffff:169.254.169.254]/",
    ])
      expect(isUnsafeUrl(url)).toBe(true);
    expect(isUnsafeUrl("http://[::ffff:8.8.8.8]/")).toBe(false);
  });
});
