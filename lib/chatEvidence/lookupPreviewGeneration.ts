import { createGateway } from "ai";

/** Read one existing generation with normal Gateway auth; never run inference. */
export async function lookupPreviewGeneration(id: string, signal: AbortSignal): Promise<unknown> {
  let receipt: unknown;
  let requested = false;
  const client = createGateway({
    fetch: async (input, init) => {
      const url = new URL(String(input));
      if (
        requested ||
        url.origin !== "https://ai-gateway.vercel.sh" ||
        url.pathname !== "/v1/generation" ||
        url.searchParams.get("id") !== id ||
        (init?.method ?? "GET").toUpperCase() !== "GET"
      )
        throw new Error("Lookup scope rejected");
      requested = true;
      const response = await fetch(input, { ...init, signal, redirect: "error" });
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      if (reader) {
        try {
          while (true) {
            signal.throwIfAborted();
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > 16384) throw new Error("Oversized accounting receipt");
            chunks.push(value);
          }
        } catch (error) {
          await reader.cancel().catch(() => {});
          throw error;
        } finally {
          reader.releaseLock();
        }
      }
      const body = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      if (response.ok) receipt = JSON.parse(new TextDecoder().decode(body)).data;
      return new Response(body, { status: response.status, headers: response.headers });
    },
  });
  await client.getGenerationInfo({ id });
  return receipt;
}
