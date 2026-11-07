import type { ChatCase } from "../chatCases";
/** Versioned overlay; original questions, keys, historical references and grades stay untouched. */
export function correctedChatCases(historical: readonly ChatCase[]): ChatCase[] {
  return historical.map(c =>
    c.key === "willie-colon-blades"
      ? {
          ...c,
          reference:
            "The first album remains unresolved from the conflicting saved accounts. Glide calls Metiendo Mano! (1977) the first collaboration. Rolling Stone says Colón recorded The Good, The Bad, The Ugly with Lavoe, Rubén Blades and Yomo Toro. Attribute both accounts, including uncertainty in the opening; do not invent full-versus-partial collaboration, billing or participant distinctions. The Cua Cua Ra, Cua Cua / 1975 heading is a song-section date, not independently an album-release date.",
          note: "Corrected reference v2, 2026-11-06 independent audit. Source-faithful uncertainty is responsive; historical grades are not rescored.",
        }
      : c.key === "dutchyyy-aliases"
        ? {
            ...c,
            reference:
              "The 13-page timeline includes Dutchmassive (overview: 1998–present), Dutchy (2012–2019), Dutchyyy (primary alias from 2019, with a documented 2007 credit), and The Chill Factor (explicit alias on physical page 2, documented in 2001 for We’re Here Now, LE060). A documented year is not a start/end interval; primary from 2019 does not mean first used then. Do not invent retroactive naming or uninterrupted overlap. Equilibrium and Walkmen are group identities, not automatically solo aliases. The Hobbyshop Hero has weaker parenthetical-credit evidence and requires qualification. Inspect the full transcript and cross-page qualifications, not only the page-1 overview.",
            note: "Corrected reference v2, 2026-11-06 independent audit. Full PDF text capture is required before scoring. Historical grades remain unchanged.",
          }
        : { ...c },
  );
}
