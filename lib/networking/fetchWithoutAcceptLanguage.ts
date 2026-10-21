import http from "node:http";
import https from "node:https";

/**
 * A GET like `fetch`, sending only the caller's headers. Node's `fetch` adds
 * `Accept-Language: *`, which Spotify echoes into every `href` as
 * `?locale=*`; MusicNerdWeb's axios requests send no `Accept-Language`, so its
 * `href`s carry none. External clients get MusicNerdWeb's bytes.
 *
 * @param url - The URL to GET.
 * @param init - `headers` and `signal`; other fields are ignored.
 * @returns The response, as `fetch` would return it. Rejects on a network error or abort.
 */
export function fetchWithoutAcceptLanguage(url: string, init: RequestInit = {}): Promise<Response> {
  const target = new URL(url);
  const client = target.protocol === "http:" ? http : https;
  return new Promise((resolve, reject) => {
    const req = client.get(
      target,
      {
        headers: Object.fromEntries(new Headers(init.headers).entries()),
        signal: init.signal ?? undefined,
      },
      res => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("error", reject);
        res.on("end", () => {
          const status = res.statusCode ?? 500;
          const headers = new Headers();
          for (const [name, value] of Object.entries(res.headers))
            if (value !== undefined)
              headers.set(name, Array.isArray(value) ? value.join(", ") : value);
          resolve(
            new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), {
              status,
              statusText: res.statusMessage,
              headers,
            }),
          );
        });
      },
    );
    req.on("error", reject);
  });
}
