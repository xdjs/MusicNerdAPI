/**
 * The Music Nerd page where a member signs in and approves an agent.
 *
 * @returns `OAUTH_CONSENT_URL`; throws when it isn't set.
 */
export function getConsentUrl(): string {
  const url = process.env.OAUTH_CONSENT_URL;
  if (!url) throw new Error("OAUTH_CONSENT_URL is not set");
  return url;
}
