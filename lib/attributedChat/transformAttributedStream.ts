import type { UIMessageChunk } from "ai";
import type { createAttributionRegistry } from "./createAttributionRegistry";
import type { AttributionState } from "./types";

/** Consume the actual SDK UI stream before public merge; expose only server-resolved passages. */
export function transformAttributedStream(
  input: ReadableStream<UIMessageChunk>,
  options: {
    registry: ReturnType<typeof createAttributionRegistry>;
    maxTextCharacters?: 6000 | 12000;
    signal: AbortSignal;
    onFailure?: () => void;
    observeToolEvent?: (part: UIMessageChunk) => void;
  },
) {
  const maxTextCharacters = options.maxTextCharacters ?? 6000;
  if (maxTextCharacters !== 6000 && maxTextCharacters !== 12000)
    throw new Error("Unsupported attributed text limit");
  let reader: ReadableStreamDefaultReader<UIMessageChunk>;
  let consumerCancelled = false;
  const cancellation = new AbortController();
  const signal = AbortSignal.any([options.signal, cancellation.signal]);
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      void (async () => {
        reader = input.getReader();
        const selected = new Set<string>();
        let pending = "";
        let ended = false;
        let finished = false;
        let failed = false;
        let total = 0;
        let totalSerializedBytes = 0;
        let emitted = 0;
        let closed = false;
        const emit = (part: UIMessageChunk) => {
          if (!closed && !consumerCancelled) controller.enqueue(part);
        };
        const state = (value: AttributionState) =>
          emit({
            type: "data-attributed-status",
            id: "attributed-status",
            data: {
              version: 1,
              state: value,
              selectionMayBeIncomplete: true,
              pdfTextUnavailable: options.registry.pdfUnavailable,
            },
          });
        const fail = () => {
          failed = true;
          options.onFailure?.();
        };
        const onAbort = () => {
          void reader.cancel().catch(() => undefined);
        };
        signal.addEventListener("abort", onAbort, { once: true });
        state("selecting");
        const line = async (value: string) => {
          if (!value.trim()) return;
          if (ended) throw new Error("Data after selector end");
          if (/^\s*\{\s*"end"\s*:\s*true\s*\}\s*$/.test(value)) {
            ended = true;
            return;
          }
          // Restricted grammar rejects duplicate keys before JSON.parse can discard them.
          if (
            !/^\s*\{\s*"blocks"\s*:\s*\[\s*"[a-f0-9]{64}"(?:\s*,\s*"[a-f0-9]{64}")*\s*\]\s*\}\s*$/.test(
              value,
            )
          )
            throw new Error("Invalid selection record");
          const ids = (JSON.parse(value) as { blocks: string[] }).blocks;
          if (ids.some(id => selected.has(id)) || selected.size + ids.length > 24)
            throw new Error("Repeated or excessive block selection");
          const passages = await options.registry.resolve(ids, signal);
          if (total + passages.reduce((n, p) => n + p.text.length, 0) > maxTextCharacters)
            throw new Error("Passage output limit reached");
          const nextSerializedBytes = passages.reduce(
            (bytes, passage) =>
              bytes + Buffer.byteLength(JSON.stringify({ version: 1, ...passage }), "utf8"),
            0,
          );
          if (totalSerializedBytes + nextSerializedBytes > 65536)
            throw new Error("Serialized passage-data budget reached");
          signal.throwIfAborted();
          totalSerializedBytes += nextSerializedBytes;
          for (const passage of passages) {
            selected.add(passage.id);
            total += passage.text.length;
            emitted++;
            emit({
              type: "data-attributed-passage",
              id: passage.id,
              data: { version: 1, ...passage },
            });
          }
        };
        try {
          signal.throwIfAborted();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            signal.throwIfAborted();
            if (finished) throw new Error("Chunk after finish");
            if (value.type === "text-delta") {
              // Bound each JSON line, independently of SDK/network delta grouping.
              // Never append an arbitrarily large whole delta to the pending record.
              let offset = 0;
              for (;;) {
                const at = value.delta.indexOf("\n", offset);
                const end = at < 0 ? value.delta.length : at;
                if (pending.length + end - offset > 2048)
                  throw new Error("Selector record too large");
                pending += value.delta.slice(offset, end);
                if (at < 0) break;
                const complete = pending;
                pending = "";
                await line(complete);
                offset = at + 1;
              }
            } else if (value.type === "finish") {
              finished = true;
              if (value.finishReason !== "stop") throw new Error("Incomplete provider generation");
            } else if (value.type === "error" || value.type === "abort")
              throw new Error("Provider stream failed");
            else if (
              [
                "tool-input-start",
                "tool-input-available",
                "tool-output-available",
                "tool-output-error",
              ].includes(value.type)
            )
              options.observeToolEvent?.(value);
            // Files, reasoning, source parts, tool payloads and provider metadata never cross this boundary.
          }
          await line(pending);
          signal.throwIfAborted();
          if (!finished || !ended) throw new Error("Incomplete selection stream");
          if (selected.size) await options.registry.resolve([...selected], signal);
          state(emitted ? "complete-transport" : "unavailable");
          emit({ type: "finish", finishReason: "stop" });
        } catch {
          fail();
          state(signal.aborted ? "stopped" : emitted ? "partial" : "failed");
          emit({
            type: "error",
            errorText: "Source selection did not complete. Any displayed passages are partial.",
          });
        } finally {
          signal.removeEventListener("abort", onAbort);
          if (failed || signal.aborted) await reader.cancel().catch(() => undefined);
          reader.releaseLock();
          closed = true;
          if (!consumerCancelled) controller.close();
        }
      })();
    },
    async cancel(reason) {
      consumerCancelled = true;
      cancellation.abort(reason);
      options.onFailure?.();
      await reader?.cancel(reason);
    },
  });
}
