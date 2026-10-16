/** Identify explicit authentication and anti-bot destinations, not article text or query keywords. */
export function isSourceAccessGateUrl(value: string): boolean {
  let url: URL;
  let path: string;
  try {
    url = new URL(value);
    path = decodeURIComponent(url.pathname).toLowerCase();
  } catch {
    return true;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (["accounts.google.com", "consent.google.com", "consent.youtube.com"].includes(host))
    return true;
  if ((host === "google.com" || host.endsWith(".google.com")) && /^\/sorry(?:\/|$)/.test(path))
    return true;
  return (
    /^\/cdn-cgi\/(?:challenge-platform|l\/chk_captcha|l\/chk_jschl)(?:\/|$)/.test(path) ||
    /^\/(?:login|log-in|signin|sign-in|captcha|challenge)(?:\/|$)/.test(path)
  );
}
