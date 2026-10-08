import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { extractVaultText } from "@/lib/sourceExtraction/extractVaultText";
import { isPublicAddress } from "@/lib/sourceExtraction/isPublicAddress";
import type { FetchedSource } from "@/lib/sourceExtraction/types";

/** Bounded public HTML fetch with DNS pinning and independent redirect validation. */
export async function fetchSourceText(input: string, budgetMs: number): Promise<FetchedSource> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), Math.max(1, Math.min(15_000, budgetMs)));
  let httpStatus: number | null = null;
  const result = (
    status: FetchedSource["status"],
    extra: Partial<FetchedSource> = {},
  ): FetchedSource => ({
    status,
    capturedAt: new Date().toISOString(),
    httpStatus,
    truncated: false,
    ...extra,
  });
  try {
    let url = new URL(input);
    for (let hop = 0; hop <= 3; hop++) {
      const host = url.hostname.replace(/^\[|\]$/g, "");
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.port ||
        (isIP(host) && !isPublicAddress(host))
      )
        return result("blocked");
      const addresses = isIP(host)
        ? [{ address: host, family: isIP(host) }]
        : await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
            const onAbort = () => reject(new Error("Fetch timeout"));
            abort.signal.addEventListener("abort", onAbort, { once: true });
            lookup(host, { all: true })
              .then(resolve, reject)
              .finally(() => abort.signal.removeEventListener("abort", onAbort));
          });
      if (!addresses.length || addresses.some(a => !isPublicAddress(a.address)))
        return result("blocked");
      abort.signal.throwIfAborted();
      const address = addresses[0];
      const response = await new Promise<IncomingMessage>((resolve, reject) => {
        const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(
          url,
          {
            agent: false,
            signal: abort.signal,
            headers: {
              "User-Agent": "MusicNerdSourceReader/1.0",
              Accept: "text/html, application/xhtml+xml",
              "Accept-Encoding": "identity",
            },
            lookup: (_hostname, options, callback) => {
              if (options.all) callback(null, [address]);
              else callback(null, address.address, address.family);
            },
          },
          resolve,
        );
        req.on("error", reject);
        req.end();
      });
      httpStatus = response.statusCode ?? null;
      if ([301, 302, 303, 307, 308].includes(httpStatus ?? 0)) {
        const location = response.headers.location;
        response.destroy();
        if (!location || hop === 3) return result("unavailable");
        url = new URL(location, url);
        continue;
      }
      if (httpStatus !== 200) {
        response.destroy();
        return result([401, 403, 429].includes(httpStatus ?? 0) ? "blocked" : "unavailable");
      }
      if (
        !/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(
          response.headers["content-type"] ?? "",
        ) ||
        (response.headers["content-encoding"] &&
          response.headers["content-encoding"] !== "identity")
      ) {
        response.destroy();
        return result("unsupported");
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of response) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > 2 * 1024 * 1024) {
          response.destroy();
          return result("too_large");
        }
        chunks.push(buffer);
      }
      const charset =
        /charset\s*=\s*["']?([^\s;"']+)/i.exec(response.headers["content-type"] ?? "")?.[1] ??
        "utf-8";
      let html: string;
      try {
        html = new TextDecoder(charset, { fatal: true }).decode(Buffer.concat(chunks));
      } catch {
        return result("unsupported");
      }
      const extracted = extractVaultText(html);
      if (!extracted.text) return result("empty");
      // A challenge page is content from the gate, never artist evidence.
      if (
        /just a moment|verify (?:you are human|your browser)|checking your browser|enable javascript and cookies|access denied/i.test(
          extracted.text.slice(0, 2000),
        ) &&
        extracted.text.length < 5000
      )
        return result("blocked");
      return result("ready", {
        text: extracted.text,
        truncated: extracted.truncated,
        resolvedUrl: url.href,
      });
    }
    return result("unavailable");
  } catch {
    return result("unavailable");
  } finally {
    clearTimeout(timer);
  }
}
