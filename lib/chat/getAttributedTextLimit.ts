/** A presentation capability, never authorization; all other clients retain the legacy bound. */
export function getAttributedTextLimit(request: Request): 6000 | 12000 {
  return request.headers.get("accept") === "text/event-stream; musicnerd-attributed-text=12000"
    ? 12000
    : 6000;
}
