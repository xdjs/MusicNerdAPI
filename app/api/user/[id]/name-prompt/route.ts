import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postNamePromptHandler } from "@/lib/user/postNamePromptHandler";

export const dynamic = "force-dynamic";

/** Mark the username prompt as shown for this user. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return postNamePromptHandler(request, (await context.params).id);
}

/** CORS preflight. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
