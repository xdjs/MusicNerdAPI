import type { DiscoveredProfile } from "@/lib/discovery/types";

/**
 * A discovered profile for tests.
 *
 * @param siteName - The platform.
 * @param value - The handle.
 * @param extra - Overrides.
 * @returns The profile.
 */
export function profile(
  siteName: string,
  value = "v",
  extra: Partial<DiscoveredProfile> = {},
): DiscoveredProfile {
  return {
    siteName,
    displayName: siteName,
    value,
    profileUrl: `https://${siteName}.com/${value}`,
    logoUrl: null,
    colorHex: null,
    previewImage: null,
    reasoning: null,
    provisional: false,
    ...extra,
  };
}
