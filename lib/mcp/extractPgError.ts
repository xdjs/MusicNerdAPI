/**
 * The Postgres error code and constraint behind a thrown error, looking at the
 * error itself and then its `cause`, since Drizzle wraps driver errors.
 *
 * @param err - What was thrown.
 * @returns The code and constraint name, or null when it isn't a Postgres error.
 */
export function extractPgError(err: unknown): { code: string; constraint: string } | null {
  for (const obj of [
    err,
    err && typeof err === "object" && "cause" in err ? (err as { cause: unknown }).cause : null,
  ]) {
    if (
      obj &&
      typeof obj === "object" &&
      "code" in obj &&
      typeof (obj as { code: unknown }).code === "string"
    ) {
      return {
        code: (obj as { code: string }).code,
        constraint:
          "constraint_name" in obj
            ? String((obj as { constraint_name: unknown }).constraint_name)
            : "constraint" in obj
              ? String((obj as { constraint: unknown }).constraint)
              : "",
      };
    }
  }
  return null;
}
