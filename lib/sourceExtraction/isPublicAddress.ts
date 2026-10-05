import { BlockList, isIP } from "node:net";

/** Allow public unicast destinations only, including after DNS resolution. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  const blocked = new BlockList();
  if (family === 4) {
    for (const [network, prefix] of [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.88.99.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ] as const)
      blocked.addSubnet(network, prefix, "ipv4");
    return !blocked.check(address, "ipv4");
  }
  if (family !== 6) return false;
  const global = new BlockList();
  global.addSubnet("2000::", 3, "ipv6");
  blocked.addSubnet("2001::", 23, "ipv6");
  blocked.addSubnet("2001:db8::", 32, "ipv6");
  blocked.addSubnet("2002::", 16, "ipv6");
  blocked.addSubnet("3fff::", 20, "ipv6");
  return global.check(address, "ipv6") && !blocked.check(address, "ipv6");
}
