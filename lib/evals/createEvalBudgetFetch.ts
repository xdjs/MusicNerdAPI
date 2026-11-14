/** Reservation ceiling in micro-dollars: the 12-case suite at its conservative rates fits under ten dollars; actual spend is about a dollar. */
const CEILING_MICROS = 10000000;

/**
 * Micro-dollars reserved per input byte, per output token and per base64 PDF character, by
 * gateway model id. Deliberately above the gateway's list prices (2026-11-12: Sonnet 5.5
 * $3/$15 per million tokens, Gemini 2.5 Flash $0.30/$2.50, Gemini 3.8 Flash $0.75/$3.75,
 * Gemini 4 Hydrogen $1.50/$7.50, GPT-5.4 $2.50/$15). A model not listed here is refused.
 */
const PRICED_MODELS: Record<string, { input: number; output: number; file: number }> = {
  "anthropic/claude-sonnet-5.5": { input: 4, output: 20, file: 0.5 },
  "google/gemini-2.5-flash": { input: 1, output: 6, file: 0.125 },
  "google/gemini-3.8-flash": { input: 1, output: 6, file: 0.125 },
  "google/gemini-4-hydrogen": { input: 2, output: 10, file: 0.25 },
  "openai/gpt-5.4": { input: 4, output: 20, file: 0.5 },
  // Embedding model (MODEL_EMBEDDING): $0.02 per million input tokens, charged per estimated token.
  "openai/text-embedding-3-small": { input: 0.02, output: 0, file: 0 },
};
const MAX_PAID_REQUESTS = 150;

/** Collect native file parts anywhere in the body; only PDFs are priced, anything else is refused. */
function collectFileParts(value: unknown, into: string[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectFileParts(item, into);
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.type === "file" || record.type === "file-data" || record.type === "image") {
    // Prompt file parts carry a base64 string; tool-result file parts may wrap it as
    // { type: "data", data } (the handler's shape). URLs and non-PDF media stay unpriced.
    const data = record.data as unknown;
    const base64 =
      typeof data === "string"
        ? data
        : data && typeof data === "object" && typeof (data as { data?: unknown }).data === "string"
          ? (data as { data: string }).data
          : undefined;
    if (record.type === "image" || record.mediaType !== "application/pdf" || base64 === undefined)
      throw new Error("unpriced native tool or media");
    into.push(base64);
    return;
  }
  for (const child of Object.values(record)) collectFileParts(child, into);
}

/**
 * Eval-only transport guard. Reserve a conservative text-token cost before egress,
 * never refund failed calls, and latch closed at the approved ten-dollar envelope.
 * Rates include headroom over the October 29 Gateway catalog and Tavily PAYG rates.
 * Native PDF input is priced per base64 character, far above its page-based billing.
 * Destination rule: only a violation on a paid provider (ai-gateway.vercel.sh, api.tavily.com)
 * latches the run closed. Any other destination is refused for that request alone and does not
 * stop the run, so tooling that talks to its own hosts cannot starve later priced calls.
 * This is a reservation ledger, not a provider invoice. No shared settings change.
 */
export function createEvalBudgetFetch(send: typeof fetch, priorReservedMicros = 0) {
  if (
    !Number.isSafeInteger(priorReservedMicros) ||
    priorReservedMicros < 0 ||
    priorReservedMicros > CEILING_MICROS
  )
    throw new Error("Invalid prior eval reservation");
  let reservedMicros = priorReservedMicros;
  let paidRequests = 0;
  let blocked = false;
  let stopReason: string | undefined;
  let blockedBy: string | undefined;
  // Short fixed label of the request being judged; never a URL query, body or header value.
  let kind = "unknown";
  const refusedHosts = new Set<string>();
  const fail = (reason: string): never => {
    blocked = true;
    if (stopReason === undefined) {
      stopReason = reason;
      blockedBy = kind;
      console.error(`[eval-budget] blocked: ${reason} (${kind})`);
    }
    throw new Error(`Eval budget guard: ${reason}`);
  };
  const guarded: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    kind =
      url.hostname === "ai-gateway.vercel.sh"
        ? url.pathname.endsWith("/language-model")
          ? "language-model"
          : url.pathname.endsWith("/embedding-model")
            ? "embedding-model"
            : "other-gateway"
        : url.hostname === "api.tavily.com"
          ? "tavily"
          : `host:${url.hostname}`;
    if (url.protocol !== "https:") return fail("HTTPS required");
    // Logging is not model execution. Other Braintrust endpoints are not allowed here.
    if (
      (url.hostname === "api.braintrust.dev" || url.hostname === "www.braintrust.dev") &&
      !/proxy|invoke|function/.test(url.pathname)
    )
      return send(input, init);
    // Refetching a cited public original for the judge costs no model spend.
    if (
      (init?.method ?? "GET").toUpperCase() === "GET" &&
      /\.supabase\.co$/.test(url.hostname) &&
      url.pathname.startsWith("/storage/v1/object/public/")
    )
      return send(input, init);
    // Not a paid provider: refuse this request only. It must not stop the run, because
    // tooling (the Braintrust CLI's S3 bundle upload) legitimately talks to other hosts.
    if (url.hostname !== "ai-gateway.vercel.sh" && url.hostname !== "api.tavily.com") {
      if (!refusedHosts.has(url.hostname)) {
        refusedHosts.add(url.hostname);
        console.error(`[eval-budget] refused: unapproved network destination (${kind})`);
      }
      throw new Error("Eval budget guard: unapproved network destination");
    }
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
      const price = model ? PRICED_MODELS[model] : undefined;
      if (!price) return fail("unpriced model");
      if (!Array.isArray(body.prompt)) return fail("missing prompt");
      for (const message of body.prompt) {
        if (!message || typeof message !== "object") return fail("invalid message");
        if (
          Array.isArray(message.content) &&
          message.content.some(
            (part: { type?: string; kind?: string }) =>
              !part ||
              // "file" is allowed here only to reach collectFileParts below, which prices PDFs and refuses the rest.
              (!["text", "file", "tool-call", "tool-result", "reasoning"].includes(
                part.type ?? "",
              ) &&
                !(part.type === "custom" && part.kind === "anthropic.message_start")),
          )
        )
          return fail("non-text input");
      }
      if (
        JSON.stringify(body).includes('"type":"provider"') ||
        JSON.stringify(body).includes('"type":"provider-defined"')
      )
        return fail("unpriced native tool or media");
      const files: string[] = [];
      try {
        collectFileParts(body.prompt, files);
      } catch {
        return fail("unpriced native tool or media");
      }
      const fileCharacters = files.reduce((n, data) => n + data.length, 0);
      if (fileCharacters > 6000000) return fail("PDF input outside priced envelope");
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
      const bytes = Buffer.byteLength(JSON.stringify(body), "utf8") - fileCharacters;
      if (bytes > 200000) return fail("input outside priced text envelope");
      const fileMicros = Math.ceil(fileCharacters * price.file);
      reservation =
        (bytes + 8192) * price.input + Number(body.maxOutputTokens) * price.output + fileMicros;
    } else if (
      url.hostname === "ai-gateway.vercel.sh" &&
      url.pathname.endsWith("/embedding-model")
    ) {
      // The gateway embedding call posts { values: string[] } with the model id in `ai-model-id`.
      const model = new Headers(init.headers).get("ai-model-id");
      const price = model ? PRICED_MODELS[model] : undefined;
      if (!price) return fail("unpriced model");
      if (!Array.isArray(body.values)) return fail("missing values");
      reservation = Math.ceil(Math.ceil(JSON.stringify(body.values).length / 4) * price.input);
    } else if (url.hostname === "ai-gateway.vercel.sh" && url.pathname.endsWith("-model")) {
      return fail("unpriced gateway path");
    } else if (url.hostname === "api.tavily.com" && url.pathname === "/search") {
      if (Object.keys(body).some(key => !["query", "include_domains", "max_results"].includes(key)))
        return fail("unpriced search options");
      reservation = 16000; // two credits at $0.008; current request defaults to one.
    } else return fail("unapproved network destination"); // a paid host with an unapproved path
    if (paidRequests >= MAX_PAID_REQUESTS || reservedMicros + reservation > CEILING_MICROS)
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
    snapshot: () => ({
      reservedUsd: reservedMicros / 1000000,
      paidRequests,
      blocked,
      stopReason,
      blockedBy,
      refusedHosts: [...refusedHosts],
    }),
  };
}
