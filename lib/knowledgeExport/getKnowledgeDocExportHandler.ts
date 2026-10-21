import { NextResponse } from "next/server";
import { getArtistById } from "@/lib/artists/getArtistById";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { artistFileSlug } from "@/lib/knowledgeExport/artistFileSlug";
import { csvCell } from "@/lib/knowledgeExport/csvCell";
import { renderKnowledgeMarkdown } from "@/lib/knowledgeExport/renderKnowledgeMarkdown";
import { getArtistDoc } from "@/lib/lore/getArtistDoc";
import type { DocSource } from "@/lib/lore/types";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/artist/{id}/knowledge-doc/export: the claimant or an admin
 * downloads the Lore document as one Markdown file, or with `?format=csv` its
 * sources as a table. Gated like the document itself: the export is never a
 * wider door than the page.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param id - The artist id from the path.
 * @returns 200 with the file as an attachment; 400, 401, 403, 404 or 500 with `{ status, error }`.
 */
export async function getKnowledgeDocExportHandler(request: Request, id: string) {
  const headers = getCorsHeaders();
  try {
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;
    const [artist, doc] = await Promise.all([getArtistById(id), getArtistDoc(id)]);
    if (!artist || !doc?.content)
      return NextResponse.json(
        { status: "error", error: "No knowledge document yet" },
        { status: 404, headers },
      );
    const name = artist.name ?? "Unknown Artist";
    const sources = (doc.sources ?? []) as DocSource[];
    const stamp = new Date().toISOString().slice(0, 10);
    // A cross-origin download reads its file name from this header.
    const fileHeaders = { ...headers, "Access-Control-Expose-Headers": "Content-Disposition" };
    if (new URL(request.url).searchParams.get("format") === "csv") {
      const header = ["id", "kind", "label", "url", "published"].join(",");
      const rows = sources.map(s =>
        [s.id, s.kind, s.label ?? "", s.url ?? "", s.publishedAt ?? ""].map(csvCell).join(","),
      );
      return new Response([header, ...rows].join("\n"), {
        headers: {
          ...fileHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${artistFileSlug(name)}-sources-${stamp}.csv"`,
        },
      });
    }
    const body = renderKnowledgeMarkdown({
      name,
      content: doc.content,
      sources,
      header: `> Verified profile compiled by Music Nerd from ${sources.length} source${sources.length === 1 ? "" : "s"}, exported ${stamp}.`,
    });
    return new Response(body, {
      headers: {
        ...fileHeaders,
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${artistFileSlug(name)}-${stamp}.md"`,
      },
    });
  } catch (e) {
    console.error("[knowledge-doc/export] Error:", e);
    return NextResponse.json({ status: "error", error: "Export failed" }, { status: 500, headers });
  }
}
