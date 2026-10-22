/**
 * Posts a plain-text message to the team's Discord webhook. Does nothing when
 * `DISCORD_WEBHOOK_URL` is unset, and never throws: a notification must not
 * fail the request that sent it.
 *
 * @param message - The message.
 * @returns Once posted, or once the failure is logged.
 */
export async function sendDiscordMessage(message: string): Promise<void> {
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!discordWebhookUrl) return;
  try {
    const response = await fetch(discordWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    if (!response.ok) throw new Error(`Discord responded ${response.status}`);
  } catch (e) {
    console.error("[sendDiscordMessage] Error sending Discord message", e);
  }
}
