/** Fixed diagnostic labels only: never serialize exceptions, request URLs, headers or response bodies. */
export function getLatestProviderFailure(error: unknown) {
  const value = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const phases = ["token", "request", "body", "parse", "normalize", "snapshot"];
  const codes = [
    "missing_credentials",
    "http_error",
    "network_error",
    "timeout",
    "invalid_payload",
    "body_too_large",
    "snapshot_too_large",
  ];
  return {
    phase:
      typeof value.latestPhase === "string" && phases.includes(value.latestPhase)
        ? value.latestPhase
        : "unknown",
    code:
      typeof value.latestCode === "string" && codes.includes(value.latestCode)
        ? value.latestCode
        : "unknown",
    httpStatus:
      typeof value.status === "number" &&
      Number.isInteger(value.status) &&
      value.status >= 100 &&
      value.status <= 599
        ? value.status
        : null,
  };
}
