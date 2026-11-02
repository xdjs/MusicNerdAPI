/** Test-only bounded recorder. It never constructs a provider or performs I/O. */
export function createOfflineChatTrace() {
  const events: { kind: string; value: unknown }[] = [];
  let started = false;
  let failure: string | undefined;
  let steps = 0;
  let capturedBytes = 0;
  let outputCharacters = 0;
  const fail = (reason: string): never => {
    failure ??= reason;
    throw new Error(failure);
  };
  const record = (kind: string, value: unknown) => {
    if (failure) fail(failure);
    const serialized = JSON.stringify({ kind, value });
    const bytes = Buffer.byteLength(serialized);
    if (capturedBytes + bytes > 1_000_000) fail("capture_limit");
    capturedBytes += bytes;
    events.push(JSON.parse(serialized));
  };
  return {
    begin(requestId: string) {
      if (started) fail("already_started");
      started = true;
      record("request", { requestId });
    },
    modelStep(input: unknown) {
      if (failure) fail(failure);
      if (!started) fail("not_started");
      if (steps >= 6) fail("step_limit");
      if (Buffer.byteLength(JSON.stringify(input)) > 128_000) fail("input_limit");
      record("model-input", input);
      steps++;
    },
    output(text: string) {
      if (failure) fail(failure);
      if (outputCharacters + text.length > 8192) fail("output_limit");
      outputCharacters += text.length;
    },
    record,
    snapshot() {
      return structuredClone({ events, steps, capturedBytes, outputCharacters, failure });
    },
  };
}
