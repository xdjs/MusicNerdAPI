/**
 * Eval-only transport guard. Reserve a conservative text-token cost before egress,
 * never refund failed calls, and latch closed at the approved five-dollar envelope.
 * Rates include headroom over the October 29 Gateway catalog and Tavily PAYG rates.
 * This is a reservation ledger, not a provider invoice. No shared settings change.
 */
export function createEvalBudgetFetch(send: typeof fetch, priorReservedMicros = 0) {
  if (
    !Number.isSafeInteger(priorReservedMicros) ||
    priorReservedMicros < 0 ||
    priorReservedMicros > 5000000
  )
    throw new Error("Invalid prior eval reservation");
  let reservedMicros = priorReservedMicros;
  let paidRequests = 0;
  let blocked = false;
  let stopReason: string | undefined;
  const fail = (reason: string): never => {
    blocked = true;
    stopReason ??= reason;
    throw new Error(`Eval budget guard: ${reason}`);
  };
  const guarded: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.protocol !== "https:") return fail("HTTPS required");
    // Logging is not model execution. Other Braintrust endpoints are not allowed here.
    if (
      (url.hostname === "api.braintrust.dev" || url.hostname === "www.braintrust.dev") &&
      !/proxy|invoke|function/.test(url.pathname)
    )
      return send(input, init);
    if (blocked) return fail("run already stopped");
    if (typeof init?.body !== "string" || init.method !== "POST")
      return fail("unexpected request shape");
    let parsed: unknown;
    try {
      parsed = JSON.parse(init.body);
    } catch {
      return fail("invalid JSON body");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return fail("invalid request body");
    const body = parsed as Record<string, unknown>;
    let reservation: number;
    if (url.hostname === "ai-gateway.vercel.sh" && url.pathname.endsWith("/language-model")) {
      const model = new Headers(init.headers).get("ai-language-model-id");
      if (model !== "anthropic/claude-sonnet-5.5" && model !== "google/gemini-2.5-flash")
        return fail("unpriced model");
      if (!Array.isArray(body.prompt)) return fail("missing prompt");
      for (const message of body.prompt) {
        if (!message || typeof message !== "object") return fail("invalid message");
        if (
          Array.isArray(message.content) &&
          message.content.some(
            (part: { type?: string; kind?: string }) =>
              !part ||
              (!["text", "tool-call", "tool-result", "reasoning"].includes(part.type ?? "") &&
                !(part.type === "custom" && part.kind === "anthropic.message_start")),
          )
        )
          return fail("non-text input");
      }
      if (
        JSON.stringify(body).includes('"type":"provider"') ||
        JSON.stringify(body).includes('"type":"provider-defined"') ||
        JSON.stringify(body).includes('"type":"file"') ||
        JSON.stringify(body).includes('"type":"image"')
      )
        return fail("unpriced native tool or media");
      // Restrict to the existing low-effort chat options; no fallback models, BYOK,
      // cache controls or service tiers whose billing could escape this envelope.
      const options = body.providerOptions as Record<string, unknown> | undefined;
      if (options && Object.keys(options).some(key => key !== "anthropic" && key !== "google"))
        return fail("unpriced provider options");
      body.maxOutputTokens = Math.min(
        typeof body.maxOutputTokens === "number" ? body.maxOutputTokens : 2048,
        2048,
      );
      if (!Number.isInteger(body.maxOutputTokens) || Number(body.maxOutputTokens) < 1)
        return fail("invalid output limit");
      // One input token per UTF-8 byte plus framing allowance; deliberately much
      // higher than ordinary text tokenization. Reserve cache-write/regional headroom.
      const bytes = Buffer.byteLength(JSON.stringify(body), "utf8");
      if (bytes > 200000) return fail("input outside priced text envelope");
      const inputMicros = model.startsWith("anthropic/") ? 4 : 1;
      const outputMicros = model.startsWith("anthropic/") ? 20 : 6;
      reservation = (bytes + 8192) * inputMicros + Number(body.maxOutputTokens) * outputMicros;
    } else if (url.hostname === "api.tavily.com" && url.pathname === "/search") {
      if (Object.keys(body).some(key => !["query", "include_domains", "max_results"].includes(key)))
        return fail("unpriced search options");
      reservation = 16000; // two credits at $0.008; current request defaults to one.
    } else return fail("unapproved network destination");
    if (paidRequests >= 100 || reservedMicros + reservation > 5000000)
      return fail("approved request/spend envelope exhausted");
    reservedMicros += reservation;
    paidRequests += 1;
    console.log(
      `[eval-budget] requests=${paidRequests} reserved_usd=${(reservedMicros / 1000000).toFixed(6)}`,
    );
    return send(input, { ...init, body: JSON.stringify(body), redirect: "error" });
  };
  return {
    fetch: guarded,
    snapshot: () => ({ reservedUsd: reservedMicros / 1000000, paidRequests, blocked, stopReason }),
  };
}
