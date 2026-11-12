import { createHash } from "node:crypto";
import { createFixture, artist, user } from "./fixture";
import { withSyntheticDatabase } from "./context";
import { createHostedAboutAdapter } from "../hosted-about/createHostedAboutAdapter";
import { buildDocSources } from "@/lib/lore/buildDocSources";
import { getBearerToken } from "@/lib/auth/getBearerToken";

type Routes = {
  PUT: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
};
export function createAcceptance(options: {
  subjects: Readonly<Record<string, boolean>>;
  verify: (token: string) => Promise<string | null>;
  loadRoutes: () => Promise<Routes>;
  sqlRoot?: string;
}) {
  let inFlight = 0;
  const reply = (status: number, data: Record<string, unknown>) =>
    Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
  return async (request: Request) => {
    if (request.method !== "POST" || new URL(request.url).search)
      return reply(400, { status: "invalid_request" });
    if (request.signal.aborted) return reply(408, { status: "request_aborted" });
    const token = getBearerToken(request);
    if (!token || token.length > 4096) return reply(401, { status: "not_signed_in" });
    if (inFlight >= 2) return reply(429, { status: "busy" });
    inFlight++;
    try {
      if (request.body) {
        const reader = request.body.getReader();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let abort: () => void = () => {};
        try {
          const stop = new Promise<never>((_, reject) => {
            abort = () => reject(new Error("Body cancelled"));
            request.signal.addEventListener("abort", abort, { once: true });
            timer = setTimeout(abort, 2000);
            if (request.signal.aborted) abort();
          });
          const first = await Promise.race([reader.read(), stop]);
          if (!first.done) return reply(400, { status: "invalid_request" });
        } catch {
          return reply(400, { status: "invalid_request" });
        } finally {
          clearTimeout(timer);
          request.signal.removeEventListener("abort", abort);
          void reader.cancel().catch(() => {});
        }
      }
      const subject = await options.verify(token);
      if (!subject) return reply(401, { status: "not_signed_in" });
      const hash = createHash("sha256").update(subject).digest("hex");
      if (!Object.prototype.hasOwnProperty.call(options.subjects, hash))
        return reply(403, { status: "test_account_required" });
      const admin = options.subjects[hash];
      if (request.signal.aborted) return reply(408, { status: "request_aborted" });
      const pg = await createFixture(subject, admin, options.sqlRoot);
      const adapter = createHostedAboutAdapter({}, buildDocSources);
      return await withSyntheticDatabase(pg, adapter, async () => {
        const routes = await options.loadRoutes();
        const context = () => ({ params: Promise.resolve({ id: artist }) });
        const make = () =>
          new Request("http://synthetic.invalid/api/artistBio/" + artist, {
            method: "PUT",
            headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
            body: JSON.stringify({ regenerate: true }),
            signal: request.signal,
          });
        let outsiderStatus: number | null = null;
        if (!admin) {
          outsiderStatus = (await routes.PUT(make(), context())).status;
          if (outsiderStatus !== 403) throw Error("Outsider guard failed");
          await pg.exec("reset role");
          await pg.query(
            "insert into artist_claims(artist_id,user_id,status) values($1,$2,'approved')",
            [artist, user],
          );
          await pg.exec("set role mnweb");
        }
        const first = await routes.PUT(make(), context());
        if (first.status !== 200) throw Error("Missing doc request failed");
        const firstCounts = adapter.counters();
        if (firstCounts.lore !== 1 || firstCounts.about !== 1)
          throw Error("Generation order failed");
        const second = await routes.PUT(make(), context());
        if (second.status !== 200) throw Error("Existing doc request failed");
        const secondCounts = adapter.counters();
        if (secondCounts.lore !== 1 || secondCounts.about !== 2)
          throw Error("Document reuse failed");
        const read = await routes.GET(
          new Request("http://synthetic.invalid/api/artistBio/" + artist),
          context(),
        );
        const body = await read.json();
        if (read.status !== 200 || body.bio !== "Synthetic About")
          throw Error("Synthetic persistence failed");
        return reply(200, {
          status: "passed",
          actor: admin ? "admin" : "synthetic_claimant",
          outsiderStatus,
          missingDocStatus: first.status,
          existingDocStatus: second.status,
          readStatus: read.status,
          calls: secondCounts,
          scope: "one-request synthetic database; not live Supabase",
        });
      });
    } catch {
      return reply(500, { status: "synthetic_test_failed" });
    } finally {
      inFlight--;
    }
  };
}
