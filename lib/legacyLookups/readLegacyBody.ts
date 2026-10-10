/**
 * A legacy lookup's JSON body. Anything that isn't a JSON object reads as `{}`,
 * so the caller answers its usual 400 instead of failing.
 *
 * @param request - The POST request.
 * @returns The body's fields.
 */
export async function readLegacyBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
