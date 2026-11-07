import { generateKeyPairSync, sign } from "node:crypto";
import { PrivyClient } from "@privy-io/server-auth";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
let client: PrivyClient;
// Substitute remote key discovery only; production wrapper and SDK JWT checks are real.
vi.mock("@/lib/auth/getPrivyClient", () => ({ getPrivyClient: () => client }));
const { verifyPrivyAccessToken } = await import("../../../../lib/auth/verifyPrivyAccessToken");
const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const other = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
const appId = "synthetic-offline-app";
const userId = "did:privy:synthetic-offline-user";
const network = vi.fn(() => {
  throw new Error("External transport forbidden");
});
beforeEach(() => {
  client = new PrivyClient(appId, "synthetic-placeholder-not-a-credential");
  vi.spyOn(client, "getAppSettings").mockResolvedValue({ verificationKey: publicKey } as Awaited<
    ReturnType<PrivyClient["getAppSettings"]>
  >);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", network);
});
afterEach(() => {
  expect(network).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function token(overrides: Record<string, unknown> = {}, wrongKey = false, algorithm = "ES256") {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${encode({ alg: algorithm, typ: "JWT" })}.${encode({ iss: "privy.io", aud: appId, sub: userId, sid: "synthetic-session", iat: now, exp: now + 60, ...overrides })}`;
  return `${input}.${sign("sha256", Buffer.from(input), { key: wrongKey ? other.privateKey : pair.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}
it("returns the subject after real ES256 signature, issuer, audience and expiry verification", async () => {
  expect(await verifyPrivyAccessToken(token())).toBe(userId);
  expect(client.getAppSettings).toHaveBeenCalledOnce();
});
it.each([
  ["wrong audience", { aud: "another-app" }],
  ["wrong issuer", { iss: "another-issuer" }],
  ["expired", { exp: 1 }],
  ["not yet valid", { nbf: Math.floor(Date.now() / 1000) + 3600 }],
])("rejects %s", async (_name, claims) => {
  expect(await verifyPrivyAccessToken(token(claims as Record<string, unknown>))).toBeNull();
});
it("rejects a signature from another key", async () => {
  expect(await verifyPrivyAccessToken(token({}, true))).toBeNull();
});
it("rejects an unapproved algorithm", async () => {
  expect(await verifyPrivyAccessToken(token({}, false, "HS256"))).toBeNull();
});
it("rejects malformed tokens and development identity shortcuts", async () => {
  for (const value of ["broken", "privyid:synthetic-offline-user", ""])
    expect(await verifyPrivyAccessToken(value)).toBeNull();
});
