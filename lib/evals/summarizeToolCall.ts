const SEARCH_LIMIT = "Search limit reached for this answer";
const READ_ERRORS = ["Unknown document number", "Source changed or is no longer public"];
const NO_SUCH_LOCATOR = "No such locator";

const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const count = (value: unknown): number | undefined =>
  Array.isArray(value) ? value.length : undefined;

/**
 * A short, text-free description of one tool call for the public eval log: counts, flags
 * and fixed error strings only. Queries, titles, urls, passages and unit text are never
 * read into the result.
 *
 * @param name - The tool's name.
 * @param input - The tool's input.
 * @param output - The tool's output.
 * @returns The summary; `ok` or `error` when the shape is not recognised.
 */
export function summarizeToolCall(name: string, input: unknown, output: unknown): string {
  const out = record(output);
  const inp = record(input);
  const hasError = out !== undefined && "error" in out;
  const fixedError = typeof out?.error === "string" ? out.error : undefined;
  if (name === "searchPassages") {
    if (hasError) return fixedError === SEARCH_LIMIT ? `error=${SEARCH_LIMIT}` : "error";
    const results = count(out?.results);
    const docs = Array.isArray(out?.documents) ? out.documents : undefined;
    if (results === undefined || docs === undefined) return "ok";
    const shownUnits = docs.map(d => `${record(d)?.shown ?? "?"}/${record(d)?.units ?? "?"}`);
    return `results=${results} docs=${docs.length} shown/units=${shownUnits.join(",")} weak=${out?.weak === true} truncated=${out?.truncated === true} expanded=${typeof out?.expanded === "number" ? out.expanded : "none"}`;
  }
  if (name === "readUnits") {
    const n = typeof inp?.n === "number" ? inp.n : "?";
    if (hasError) {
      const known = READ_ERRORS.find(e => e === fixedError);
      if (known) return `n=${n} error=${known}`;
      return fixedError?.startsWith(NO_SUCH_LOCATOR)
        ? `n=${n} error=${NO_SUCH_LOCATOR}`
        : `n=${n} error`;
    }
    const units = count(out?.units);
    if (units === undefined) return "ok";
    const locators = count(inp?.locators);
    return `n=${n} locators=${locators ?? "all"} units=${units} truncated=${out?.truncated === true} missing=${count(out?.missing) ?? 0}`;
  }
  if (hasError) return "error";
  if (name === "listDocuments") {
    const documents = count(out?.documents);
    return documents === undefined ? "ok" : `documents=${documents}`;
  }
  if (name === "searchSources" || name === "webSearch") {
    const results = count(out?.results);
    return results === undefined ? "ok" : `results=${results}`;
  }
  if (name === "readPdfSource" || name === "readNamedPdf" || name === "searchPdfSources") {
    return typeof out?.pages === "number" ? `pages=${out.pages}` : "ok";
  }
  return "ok";
}
