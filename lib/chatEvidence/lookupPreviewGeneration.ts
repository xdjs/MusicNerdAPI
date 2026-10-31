import { createGateway } from "ai";

/** Read one existing generation with normal Gateway auth; never run inference. */
export async function lookupPreviewGeneration(id: string, signal: AbortSignal): Promise<unknown> {
  let receipt: unknown;
  let requested = false;
  let receiptCode = "receipt_client";
  let httpStatus: number | undefined;
  const fail = (code: string): never => {
    receiptCode = code;
    throw new Error("Historical receipt unavailable");
  };
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
        fail("receipt_scope");
      requested = true;
      receiptCode = "receipt_network";
      const response = await fetch(input, { ...init, signal, redirect: "error" });
      receiptCode = "receipt_read";
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
            if (length > 16384) fail("receipt_oversized");
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
      if (!response.ok) {
        httpStatus = response.status;
        fail("receipt_http");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder().decode(body));
      } catch {
        fail("receipt_json");
      }
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !("data" in parsed) ||
        !parsed.data ||
        typeof parsed.data !== "object"
      )
        fail("receipt_shape");
      receipt = (parsed as { data: unknown }).data;
      receiptCode = "receipt_sdk_schema";
      return new Response(body, { status: response.status, headers: response.headers });
    },
  });
  try {
    await client.getGenerationInfo({ id });
  } catch {
    throw Object.assign(
      new Error(
        receiptCode === "receipt_oversized"
          ? "Oversized accounting receipt"
          : "Historical receipt unavailable",
      ),
      {
        receiptCode: signal.aborted ? "receipt_aborted" : receiptCode,
        ...(httpStatus === undefined ? {} : { httpStatus }),
      },
    );
  }
  return receipt;
}
