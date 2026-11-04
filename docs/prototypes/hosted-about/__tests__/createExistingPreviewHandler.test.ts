import { expect, it, vi } from "vitest";
import { createExistingPreviewHandler } from "../createExistingPreviewHandler";
const id = "00000000-0000-4000-8000-000000000001";
const baseline = {
  PRIVY_APP_ID: "fixture",
  PRIVY_APP_SECRET: "fixture",
  SUPABASE_DB_CONNECTION: "postgres://fixture@localhost/synthetic",
};
const context = (artist = id) => ({ params: Promise.resolve({ id: artist }) });
it("rejects another artist before importing database or auth code", async () => {
  const load = vi.fn();
  const handler = createExistingPreviewHandler(id, {}, load);
  expect((await handler(new Request("http://test.invalid"), context("other"))).status).toBe(404);
  expect(load).not.toHaveBeenCalled();
});
it.each([
  "TAVILY_API_KEY",
  "APIFY_API_TOKEN",
  "MUSICNERD_RESEARCH_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DISCORD_WEBHOOK_URL",
  "NEW_VENDOR_SECRET",
  "VERCEL_OIDC_TOKEN",
  "PRIVY_API_URL",
  "PRIVY_WALLET_API_URL",
  "PGHOST",
  "PGUSER",
  "PGDATABASE",
  "DATABASE_URI",
  "UNREVIEWED_HOST_VARIABLE",
])("refuses %s without echoing values or importing handlers", async key => {
  const load = vi.fn();
  const handler = createExistingPreviewHandler(id, { ...baseline, [key]: "never-echo-this" }, load);
  const response = await handler(new Request("http://test.invalid"), context());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("never-echo-this");
  expect(load).not.toHaveBeenCalled();
});
it("retains real-handler authorization and permits only auth/database credentials", async () => {
  const real = vi.fn(
    async (_request: Request, _context: { params: Promise<{ id: string }> }) =>
      new Response("Not authorized", { status: 403 }),
  );
  const load = vi.fn(async () => real);
  const handler = createExistingPreviewHandler(
    id,
    {
      PRIVY_APP_ID: "fixture",
      PRIVY_APP_SECRET: "fixture",
      SUPABASE_DB_CONNECTION: "postgres://fixture@localhost/synthetic",
      TAVILY_API_KEY: "",
    },
    load,
  );
  const request = new Request("http://test.invalid", {
    method: "PUT",
    headers: { Authorization: "Bearer test" },
  });
  expect((await handler(request, context())).status).toBe(403);
  expect(real.mock.calls[0][0]).toBe(request);
});
it("rejects invalid build fixture IDs", () => {
  expect(() => createExistingPreviewHandler("invalid", {}, vi.fn())).toThrow(
    "Invalid synthetic artist",
  );
});

it.each(["PRIVY_APP_ID", "PRIVY_APP_SECRET", "SUPABASE_DB_CONNECTION"])(
  "refuses missing or blank %s before loading",
  async key => {
    for (const value of [undefined, "", "  "]) {
      const load = vi.fn();
      const handler = createExistingPreviewHandler(id, { ...baseline, [key]: value }, load);
      expect((await handler(new Request("http://test.invalid"), context())).status).toBe(503);
      expect(load).not.toHaveBeenCalled();
    }
  },
);
it.each([
  "fallback",
  "postgres://",
  "postgres://fixture@localhost",
  "postgres://localhost/synthetic",
])("refuses database defaults in %s", async connection => {
  const load = vi.fn();
  const handler = createExistingPreviewHandler(
    id,
    { ...baseline, SUPABASE_DB_CONNECTION: connection },
    load,
  );
  expect((await handler(new Request("http://test.invalid"), context())).status).toBe(503);
  expect(load).not.toHaveBeenCalled();
});
