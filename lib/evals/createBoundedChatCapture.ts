/** One private synchronous JSONL sink shared by guard and turn capture; no upload or raw console output. */
export function createBoundedChatCapture({
  maxBytes,
  write,
}: {
  maxBytes: number;
  /** The caller owns an exclusively created private file; must complete synchronously or throw. */
  write: (line: string) => void;
}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 4194304)
    throw new Error("eval_capture_ceiling");
  const abort = new AbortController();
  let reservedBytes = 0;
  let writtenBytes = 0;
  let attemptedRecordBytes = 0;
  let failure: string | undefined;
  const fail = (reason: string): never => {
    failure ??= reason;
    abort.abort();
    throw new Error(failure);
  };
  return {
    signal: abort.signal,
    snapshot: () => ({ maxBytes, reservedBytes, writtenBytes, attemptedRecordBytes, failure }),
    record(kind: string, value: unknown) {
      if (failure) fail(failure);
      let line: string;
      try {
        line = JSON.stringify({ kind, value }) + "\n";
      } catch {
        return fail("eval_capture_encoding");
      }
      const recordBytes = Buffer.byteLength(line);
      attemptedRecordBytes = recordBytes;
      if (recordBytes > maxBytes - reservedBytes) fail("eval_capture_limit");
      // Both producers use this same synchronous reservation, including failed writes.
      reservedBytes += recordBytes;
      try {
        const result = write(line);
        if (result !== undefined) throw new Error("synchronous_sink_required");
      } catch {
        return fail("eval_capture_write");
      }
      writtenBytes += recordBytes;
    },
  };
}
