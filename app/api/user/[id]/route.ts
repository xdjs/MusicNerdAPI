import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getUserHandler } from "@/lib/user/getUserHandler";
import { patchUserHandler } from "@/lib/user/patchUserHandler";

export const dynamic = "force-dynamic";

/** Get the authenticated user's own profile. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return getUserHandler(request, (await context.params).id);
}

/** Update the authenticated user's username. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return patchUserHandler(request, (await context.params).id);
}

/** CORS preflight. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
