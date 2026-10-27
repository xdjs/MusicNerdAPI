import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getQuestionVisitorKey } from "@/lib/questionResearch/getQuestionVisitorKey";
const m = vi.hoisted(() => ({ verify: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/auth/verifyPrivyAccessToken", () => ({ verifyPrivyAccessToken: m.verify }));
vi.mock("@/lib/auth/getUserByPrivyId", () => ({ getUserByPrivyId: m.user }));
const request = (ip?: string, token?: string) =>
  new Request("https://api.example/api/question", {
    headers: {
      ...(ip ? { "x-real-ip": ip } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("MUSICNERD_RESEARCH_API_KEY", "s".repeat(32));
  vi.stubEnv("VERCEL", "1");
  m.verify.mockResolvedValue(null);
  m.user.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
it("uses verified account identity regardless of IP, and isolates different accounts", async () => {
  m.verify.mockResolvedValue("did:privy:one");
  m.user.mockResolvedValue({ id: "user-one" });
  const first = await getQuestionVisitorKey(request("192.0.2.1", "t1"));
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  expect(await getQuestionVisitorKey(request("192.0.2.2", "t1"))).toBe(first);
  m.user.mockResolvedValue({ id: "user-two" });
  expect(await getQuestionVisitorKey(request("192.0.2.1", "t1"))).not.toBe(first);
});
it("hashes the trusted anonymous IP without accepting arbitrary identity headers", async () => {
  const first = await getQuestionVisitorKey(request("192.0.2.1"));
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  expect(
    await getQuestionVisitorKey(
      new Request("https://api.example", {
        headers: { "x-real-ip": "192.0.2.1", "x-user-id": "fake" },
      }),
    ),
  ).toBe(first);
  expect(await getQuestionVisitorKey(request("192.0.2.2"))).not.toBe(first);
  expect(m.verify).not.toHaveBeenCalled();
});
it("falls back to the IP when a bearer token does not verify to a Music Nerd user", async () => {
  m.verify.mockResolvedValue("did:privy:unknown");
  expect(await getQuestionVisitorKey(request("192.0.2.1", "t"))).toBe(
    await getQuestionVisitorKey(request("192.0.2.1")),
  );
});
it("normalizes equivalent IPv6 addresses", async () => {
  expect(await getQuestionVisitorKey(request("2001:db8::1"))).toBe(
    await getQuestionVisitorKey(request("2001:0db8:0:0:0:0:0:1")),
  );
});
it("fails closed when no verified identity or trusted valid IP exists", async () => {
  await expect(getQuestionVisitorKey(request())).rejects.toThrow();
  await expect(getQuestionVisitorKey(request("not-an-ip"))).rejects.toThrow();
  vi.stubEnv("VERCEL", "");
  await expect(getQuestionVisitorKey(request("192.0.2.1"))).rejects.toThrow();
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("MUSICNERD_RESEARCH_API_KEY", "short");
  await expect(getQuestionVisitorKey(request("192.0.2.1"))).rejects.toThrow(
    "allowance unavailable",
  );
});
