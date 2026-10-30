import { createHash } from "node:crypto";
import { runtime, ORIGIN, ARTIST, DOCUMENTS, documentBytes } from "./runtime";
import type { ledger } from "./ledger";
export function boundedFetch(send: typeof fetch, budget: ReturnType<typeof ledger> | undefined) {
  return (async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    const deny = (why: string): never => {
      budget?.halt();
      throw Error(why);
    };
    if (url.origin === ORIGIN) {
      runtime.fixtureReads.push(url.pathname);
      const doc = DOCUMENTS.find(
        d => url.pathname === `/storage/v1/object/public/vault-files/${ARTIST}/${d.id}.pdf`,
      );
      if (
        !runtime.synthetic ||
        !doc ||
        (runtime.allowedDoc !== undefined && doc.id !== runtime.allowedDoc)
      )
        return deny("Unavailable fixture fetch");
      return new Response(new Uint8Array(documentBytes(doc.id)), {
        headers: { "Content-Type": "application/pdf" },
      });
    }
    if (!budget) return deny("External network disabled offline");
    if (url.protocol !== "https:" || init?.method !== "POST" || typeof init.body !== "string")
      return deny("Unexpected paid request");
    const body = JSON.parse(init.body);
    if (url.hostname === "ai-gateway.vercel.sh" && url.pathname.endsWith("/language-model")) {
      if (
        new Headers(init.headers).get("ai-language-model-id") !== "anthropic/claude-sonnet-5.5" ||
        body.maxOutputTokens !== 2048
      )
        return deny("Model/cap mismatch");
      if (Buffer.byteLength(init.body) > 8000000) return deny("Input envelope exceeded");
      let files = 0;
      const visit = (x: unknown) => {
        if (!x || typeof x !== "object") return;
        const o = x as Record<string, unknown>;
        if (o.type === "file") {
          files++;
          const data = o.data as { type?: string; data?: string } | undefined;
          const encoded =
            data?.type === "data" && typeof data.data === "string" ? data.data : undefined;
          const runtimeHash = encoded
            ? createHash("sha256").update(Buffer.from(encoded, "base64")).digest("hex")
            : "";
          if (
            !runtime.synthetic ||
            o.mediaType !== "application/pdf" ||
            !encoded ||
            !DOCUMENTS.some(
              d =>
                d.sha256 === runtimeHash &&
                (runtime.allowedDoc === undefined || d.id === runtime.allowedDoc),
            )
          )
            deny("Unapproved native file");
        } else if (o.type === "image" || o.type === "provider" || o.type === "provider-defined")
          deny("Unapproved media/provider tool");
        for (const v of Object.values(o)) if (typeof v === "object") visit(v);
      };
      visit(body);
      if (files > 2) return deny("Repeated file envelope exceeded");
      const textOnly = JSON.stringify(body, (key, value) =>
        key === "data" && value?.type === "data"
          ? { type: "data", data: "[verified original PDF omitted for text-envelope counting]" }
          : value,
      );
      if (Buffer.byteLength(textOnly) > 200000) return deny("Text envelope exceeded");
      const options = body.providerOptions;
      if (
        options &&
        (Object.keys(options).some(k => k !== "anthropic") ||
          Object.keys(options.anthropic ?? {}).some(k => k !== "effort") ||
          options.anthropic?.effort !== "low")
      )
        return deny("Unapproved provider options");
      budget.egress("model");
      return send(input, init);
    }
    if (url.hostname === "api.tavily.com" && url.pathname === "/search" && !runtime.synthetic) {
      budget.egress("web");
      return send(input, init);
    }
    return deny("Unapproved network destination");
  }) as typeof fetch;
}
