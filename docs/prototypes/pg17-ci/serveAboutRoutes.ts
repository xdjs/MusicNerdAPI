import { createServer } from "node:http";

type Handler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

/** Loopback-only HTTP transport for actual About handlers; synthetic native-test use only. */
export async function serveAboutRoutes(
  routes: { PUT: Handler; GET: Handler; OPTIONS: () => Promise<Response> },
  artist: string,
) {
  const pathname = `/api/artistBio/${artist}`;
  const server = createServer(async (incoming, outgoing) => {
    try {
      if (incoming.url !== pathname || !["GET", "PUT", "OPTIONS"].includes(incoming.method ?? "")) {
        outgoing.writeHead(404).end();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > 2048) {
          outgoing.writeHead(413).end();
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers))
        if (value) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      const method = incoming.method!;
      const request = new Request(`http://127.0.0.1:43165${pathname}`, {
        method,
        headers,
        ...(method === "PUT" ? { body: Buffer.concat(chunks).toString("utf8") } : {}),
      });
      const response =
        method === "OPTIONS"
          ? await routes.OPTIONS()
          : await routes[method as "GET" | "PUT"](request, {
              params: Promise.resolve({ id: artist }),
            });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(await response.text());
    } catch {
      outgoing.writeHead(500).end("Synthetic transport failed");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(43165, "127.0.0.1", resolve);
  });
  return async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    );
  };
}
