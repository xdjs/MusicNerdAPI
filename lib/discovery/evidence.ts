import { z } from "zod";

/** Observed discovery inputs only. Never persist model reasoning as evidence. */
export const discoveryEvidenceSchema = z
  .object({
    version: z.literal(1),
    method: z.enum(["name_handle_probe", "name_web_search"]),
    artistName: z.string().trim().min(1).max(500),
    sourceUrl: z
      .url()
      .max(2048)
      .refine(value => {
        const url = URL.parse(value);
        return (
          !!url &&
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      }),
    observedTitle: z.string().max(2000).nullable(),
  })
  .refine(value => value.method !== "name_handle_probe" || !!value.observedTitle?.trim());

export type DiscoveryEvidence = z.infer<typeof discoveryEvidenceSchema>;
