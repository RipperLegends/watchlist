type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail({ to, subject, text, html }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.SUPABASE_SMTP_FROM_EMAIL || "no-reply@watchlist.pp.ua";
  const senderName = process.env.SUPABASE_SMTP_SENDER_NAME || "Watchlist";

  if (!apiKey) {
    return { ok: false as const, message: "Resend API key is not configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `${senderName} <${fromEmail}>`,
      to,
      subject,
      text,
      ...(html ? { html } : {})
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = String(payload?.message || payload?.error || `Resend failed with status ${response.status}`);
    return { ok: false as const, message };
  }

  return { ok: true as const };
}
