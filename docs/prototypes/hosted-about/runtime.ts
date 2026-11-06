import { buildDocSources } from "@/lib/lore/buildDocSources";
import { createHostedAboutAdapter } from "./createHostedAboutAdapter";

// Build-selected scenario, never derived from HTTP headers, query parameters or request bodies.
// Keep this module out of the production module graph. Default isolated build: success.
export const adapter = createHostedAboutAdapter({}, buildDocSources);
