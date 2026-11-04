type Context = { params: Promise<{ id: string }> };
type Handler = (request: Request, context: Context) => Promise<Response>;
/** Test-build wrapper only: reject unrelated artists/credentials before loading the real route. */
export function createExistingPreviewHandler(
  artistId: string,
  environment: Record<string, string | undefined>,
  loadHandler: () => Promise<Handler>,
): Handler {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(artistId))
    throw new Error("Invalid synthetic artist");
  const required = ["PRIVY_APP_ID", "PRIVY_APP_SECRET", "SUPABASE_DB_CONNECTION"];
  // Explicit names only. Unknown host variables require review, never a wildcard exception.
  const allowed = new Set([
    ...required,
    "NODE_ENV",
    "PATH",
    "HOME",
    "TMPDIR",
    "TMP",
    "TEMP",
    "TZ",
    "LANG",
    "LC_ALL",
    "PORT",
    "HOSTNAME",
    "PWD",
    "SHLVL",
    "_",
    "NEXT_RUNTIME",
    "NEXT_TELEMETRY_DISABLED",
    "VERCEL",
    "VERCEL_ENV",
    "VERCEL_TARGET_ENV",
    "VERCEL_URL",
    "VERCEL_REGION",
    "VERCEL_DEPLOYMENT_ID",
    "VERCEL_PROJECT_ID",
    "VERCEL_ORG_ID",
    "NEXT_DEPLOYMENT_ID",
  ]);
  return async (request, context) => {
    if ((await context.params).id !== artistId)
      return Response.json(
        { status: "error", error: "Not a configured synthetic artist" },
        { status: 404 },
      );
    let explicitDatabase = false;
    try {
      const database = new URL(environment.SUPABASE_DB_CONNECTION ?? "");
      explicitDatabase =
        ["postgres:", "postgresql:"].includes(database.protocol) &&
        Boolean(database.hostname && database.username && database.pathname.length > 1);
    } catch {
      /* Invalid or absent configuration is refused below. */
    }
    const unexpected =
      required.some(key => !environment[key]?.trim()) ||
      Object.entries(environment).some(([key, value]) => value && !allowed.has(key)) ||
      !explicitDatabase;
    if (unexpected)
      return Response.json(
        { status: "error", error: "Synthetic preview credential isolation is not verified" },
        { status: 503 },
      );
    return (await loadHandler())(request, context);
  };
}
