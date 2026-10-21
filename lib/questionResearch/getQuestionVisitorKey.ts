import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getBearerToken } from "@/lib/auth/getBearerToken";
import { getUserByPrivyId } from "@/lib/auth/getUserByPrivyId";
import { verifyPrivyAccessToken } from "@/lib/auth/verifyPrivyAccessToken";

/** Private quota identity: verified account, otherwise Vercel's overwritten proxy IP. Web read its NextAuth session; here an optional Privy bearer token plays that part, and an invalid token counts as anonymous. */
export async function getQuestionVisitorKey(request: Request): Promise<string> {
  const secret = process.env.MUSICNERD_RESEARCH_API_KEY ?? "";
  if (secret.length < 32) throw new Error("Question allowance unavailable");
  const token = getBearerToken(request);
  const privyUserId = token ? await verifyPrivyAccessToken(token) : null;
  const user = privyUserId ? await getUserByPrivyId(privyUserId) : undefined;
  let identity: string;
  if (user?.id) {
    identity = `user:${user.id}`;
  } else {
    const ip = process.env.VERCEL === "1" ? request.headers.get("x-real-ip")?.trim() : undefined;
    if (!ip || !isIP(ip)) throw new Error("Question visitor unavailable");
    const normalized = isIP(ip) === 6 ? new URL(`http://[${ip}]`).hostname : ip;
    identity = `ip:${normalized}`;
  }
  return createHmac("sha256", secret)
    .update(`musicnerd:question-allowance:v1:${identity}`)
    .digest("hex");
}
