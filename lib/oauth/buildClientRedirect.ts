/**
 * The client's redirect URI with the authorization response added to its query.
 *
 * @param redirectUri - The registered redirect URI.
 * @param params - The parameters to add; null or undefined ones are left out.
 * @returns The URL to send the browser to.
 */
export function buildClientRedirect(
  redirectUri: string,
  params: Record<string, string | null | undefined>,
): string {
  const url = new URL(redirectUri);
  for (const [name, value] of Object.entries(params))
    if (value != null) url.searchParams.set(name, value);
  return url.toString();
}
