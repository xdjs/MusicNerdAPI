import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ fetch: undefined as unknown }));
vi.mock("ai", () => ({
  createGateway: (options: { fetch: typeof fetch }) => ({
    getGenerationInfo: async ({ id }: { id: string }) => {
      m.fetch = options.fetch;
      await options.fetch(`https://ai-gateway.vercel.sh/v1/generation?id=${id}`, {
        method: "GET",
        headers: { Authorization: "fixture" },
      });
    },
  }),
}));
const { lookupPreviewGeneration } = await import("../lookupPreviewGeneration");
it("reads accounting only via the exact GET, forwarding cancellation and preserving extras", async () => {
  const mock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(
        JSON.stringify({ data: { id: "gen_x", gateway_cost: 0.1, surcharge_cost: 0.01 } }),
      ),
    );
  try {
    const signal = new AbortController().signal;
    expect(await lookupPreviewGeneration("gen_x", signal)).toEqual({
      id: "gen_x",
      gateway_cost: 0.1,
      surcharge_cost: 0.01,
    });
    expect(mock).toHaveBeenCalledWith(
      "https://ai-gateway.vercel.sh/v1/generation?id=gen_x",
      expect.objectContaining({ method: "GET", signal, redirect: "error" }),
    );
    await expect(
      (m.fetch as typeof fetch)("https://ai-gateway.vercel.sh/v4/ai/language-model", {
        method: "POST",
      }),
    ).rejects.toThrow();
    expect(mock).toHaveBeenCalledTimes(1);
  } finally {
    mock.mockRestore();
  }
});

it.each([200, 503])("cancels oversized %s bodies during reading", async status => {
  const cancel = vi.fn();
  let reads = 0;
  const body = new ReadableStream({
    pull(controller) {
      reads++;
      controller.enqueue(new Uint8Array(8192));
    },
    cancel,
  });
  const mock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status }));
  try {
    await expect(lookupPreviewGeneration("gen_x", new AbortController().signal)).rejects.toThrow(
      "Oversized",
    );
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(reads).toBeLessThanOrEqual(4);
  } finally {
    mock.mockRestore();
  }
});
