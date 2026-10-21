import { describe, it, expect } from "vitest";
import { validateAgentWorkQuery } from "@/lib/agentWork/validateAgentWorkQuery";

const request = (query = "") =>
  new Request(`https://api.musicnerd.test/api/admin/agent-work${query}`);

describe("validateAgentWorkQuery", () => {
  it("asks for the summary by default", () => {
    expect(validateAgentWorkQuery(request())).toEqual({
      details: false,
      auditPage: 1,
      auditLimit: 50,
    });
  });

  it("asks for details with the page and limit given", () => {
    expect(validateAgentWorkQuery(request("?sections=details&auditPage=3&auditLimit=25"))).toEqual({
      details: true,
      auditPage: 3,
      auditLimit: 25,
    });
  });

  it("treats any other sections value as the summary", () => {
    expect(validateAgentWorkQuery(request("?sections=summary")).details).toBe(false);
  });

  it("falls back to 1 and 50 for values that aren't numbers, as MusicNerdWeb did", () => {
    expect(validateAgentWorkQuery(request("?auditPage=abc&auditLimit=0"))).toMatchObject({
      auditPage: 1,
      auditLimit: 50,
    });
    expect(validateAgentWorkQuery(request("?auditPage=-2&auditLimit=999"))).toMatchObject({
      auditPage: -2,
      auditLimit: 999,
    });
  });
});
