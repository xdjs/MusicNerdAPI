import { describe, it, expect } from "vitest";
import { isPublicAddress } from "@/lib/sourceExtraction/isPublicAddress";
describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "100.100.100.200",
    "172.16.2.1",
    "192.168.2.1",
    "0.0.0.0",
    "192.0.2.1",
    "198.18.0.1",
    "224.1.1.1",
    "255.255.255.255",
    "::1",
    "::ffff:127.0.0.1",
    "fd00::1",
    "fe80::1",
    "2001:db8::1",
    "not-an-ip",
  ])("rejects %s", a => expect(isPublicAddress(a)).toBe(false));
  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])("permits %s", a =>
    expect(isPublicAddress(a)).toBe(true),
  );
});
