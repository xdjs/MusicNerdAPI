/**
 * The SSRF guard: rejects non-http(s) schemes, malformed URLs, localhost and
 * private, link-local and cloud-metadata addresses, including IPv6 private
 * ranges and IPv4-mapped IPv6 in both dotted and hex form.
 *
 * @param url - A URL we are about to fetch.
 * @returns True when the URL must not be fetched.
 */
export function isUnsafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "[::1]")
      return true;
    const bare = host.replace(/^\[|\]$/g, "");
    // IPv6 unique local, fc00::/7.
    if (bare.startsWith("fc") || bare.startsWith("fd")) return true;
    // fe80::/10 link-local and the deprecated fec0::/10 site-local.
    if (bare.startsWith("fe")) {
      const nibbles = parseInt(bare.slice(2, 4), 16);
      if (!isNaN(nibbles) && nibbles >= 0x80) return true;
    }
    // IPv4-mapped IPv6: ::ffff:127.0.0.1, or the hex form Node normalizes it to.
    if (bare.startsWith("::ffff:")) {
      const mapped = bare.slice(7);
      if (mapped.includes(".") && isUnsafeUrl(`http://${mapped}/`)) return true;
      const hexParts = mapped.split(":");
      if (hexParts.length === 2) {
        const hi = parseInt(hexParts[0], 16);
        const lo = parseInt(hexParts[1], 16);
        if (!isNaN(hi) && !isNaN(lo)) {
          const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
          if (isUnsafeUrl(`http://${ipv4}/`)) return true;
        }
      }
    }
    const parts = host.split(".");
    if (parts[0] === "10") return true;
    if (parts[0] === "172" && Number(parts[1]) >= 16 && Number(parts[1]) <= 31) return true;
    if (parts[0] === "192" && parts[1] === "168") return true;
    if (parts[0] === "169" && parts[1] === "254") return true;
    return false;
  } catch {
    return true;
  }
}
