import { canvasPublicPdfs, canvasPublicProfile } from "./publicPdfManifest";
/** Bounded anonymous reads from an exact allowlist; redirects and arbitrary URLs are rejected. */
export async function fetchCanvasPublicBuffer(
  url: string,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Buffer> {
  if (![canvasPublicProfile, ...canvasPublicPdfs.map(doc => doc.url)].includes(url))
    throw new Error("URL is not a preview public document");
  const response = await fetch(url, {
    redirect: "error",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok || !response.body) throw new Error("Public document unavailable");
  if (Number(response.headers.get("content-length")) > maxBytes)
    throw new Error("Public document exceeds byte limit");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw new Error("Public document exceeds byte limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks);
}
