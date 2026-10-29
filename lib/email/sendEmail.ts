/** The sender on every Music Nerd email; the domain is verified with the email provider. */
const FROM_ADDRESS = "Music Nerd <no-reply@musicnerd.xyz>";

/**
 * Sends one transactional email. Does nothing when `RESEND_API_KEY` is unset,
 * and never throws: an email must not fail the request that sent it.
 *
 * @param input - The message.
 * @param input.to - The recipient.
 * @param input.subject - The subject line.
 * @param input.html - The HTML body.
 * @returns True when the provider accepted it.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("[email] RESEND_API_KEY not set; skipping send");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!res.ok) {
      console.error(`[email] Send failed: ${res.status} ${await res.text().catch(() => "")}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] Send error:", e);
    return false;
  }
}
