/** Bound provider JSON before parsing; an oversized body is a failure, not partial evidence. */
export async function readResearchJson(response: Response): Promise<unknown> {
  if (!response.ok || !response.body) throw new Error("Research provider unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 2 * 1024 * 1024) throw new Error("Research provider response too large");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
