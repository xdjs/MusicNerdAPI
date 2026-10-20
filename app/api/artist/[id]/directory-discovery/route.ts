import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getDirectoryDiscoveryHandler } from "@/lib/directoryDiscovery/getDirectoryDiscoveryHandler";

export const dynamic = "force-dynamic";

/**
 * Directory discovery status for a recently added artist.
 *
 * @param request - The authenticated request.
 * @param context - Route context.
 * @param context.params - Artist identifier.
 * @returns The discovery state or a safe error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return getDirectoryDiscoveryHandler(request, (await context.params).id);
}

/**
 * CORS preflight.
 *
 * @returns Empty preflight response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
