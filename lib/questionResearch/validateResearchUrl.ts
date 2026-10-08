import { isIP } from "node:net";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";

/** Validate public URL syntax before a provider sees it; the original reader also pins DNS. */
export function validateResearchUrl(value: string): string {
  try {
    const u = new URL(value);
    if (
      value.length > 2048 ||
      !["http:", "https:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      u.port ||
      isIP(u.hostname.replace(/^\[|\]$/g, "")) ||
      !u.hostname.includes(".") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(u.hostname)
    )
      throw new Error();
    u.hash = "";
    return u.toString();
  } catch {
    throw new KnowledgeError("invalid_url", 400, "A public HTTP(S) source URL is required");
  }
}
