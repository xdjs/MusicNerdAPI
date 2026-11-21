import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { authenticateTeamMember } from "@/lib/team/authenticateTeamMember";

const mock = vi.hoisted(() => ({ verify: vi.fn(), user: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/auth/verifyPrivyAccessToken", () => ({ verifyPrivyAccessToken: mock.verify }));
vi.mock("@/lib/auth/getPrivyUser", () => ({ getPrivyUser: mock.user }));
vi.mock("@/lib/team/findTeamMember", () => ({ findTeamMember: mock.find }));

const request = (authorization?: string) =>
  new Request("https://api.musicnerd.test/api/team/member", {
    headers: authorization ? { authorization } : {},
  });

beforeEach(() => {
  vi.clearAllMocks();
  mock.verify.mockResolvedValue("did:privy:1");
  mock.user.mockResolvedValue({ email: { address: "a@example.com" } });
  mock.find.mockReturnValue("sweetman");
});

describe("authenticateTeamMember", () => {
  it("names a team member from their Privy email", async () => {
    expect(await authenticateTeamMember(request("Bearer token"))).toEqual({ name: "sweetman" });
    expect(mock.verify).toHaveBeenCalledWith("token");
    expect(mock.find).toHaveBeenCalledWith("a@example.com");
  });

  it("is 401 without a token", async () => {
    const res = (await authenticateTeamMember(request())) as NextResponse;
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ status: "error", error: "Not signed in" });
    expect(mock.verify).not.toHaveBeenCalled();
  });

  it("is 401 for a token Privy rejects", async () => {
    mock.verify.mockResolvedValueOnce(null);
    expect(((await authenticateTeamMember(request("Bearer bad"))) as NextResponse).status).toBe(
      401,
    );
  });

  it("is 403 for a Privy user with no email", async () => {
    mock.user.mockResolvedValueOnce({});
    const res = (await authenticateTeamMember(request("Bearer token"))) as NextResponse;
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ status: "error", error: "Not on the team" });
  });

  it("is 403 for an email off the team", async () => {
    mock.find.mockReturnValueOnce(null);
    expect(((await authenticateTeamMember(request("Bearer token"))) as NextResponse).status).toBe(
      403,
    );
  });
});
