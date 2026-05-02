type DeliveryChannel = "email" | "sms";

type PasswordResetPayload = {
  channel: DeliveryChannel;
  email?: string;
  phone?: string;
  resetLink: string;
  resetCode: string;
};

type VerificationPayload = {
  channel: DeliveryChannel;
  email?: string;
  phone?: string;
  code: string;
};

type DeliveryResult = {
  ok: boolean;
  provider?: string;
  error?: string;
};

function isConfigured(value?: string) {
  return Boolean(value && value.trim());
}

async function sendWithResend(
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!isConfigured(apiKey) || !isConfigured(from)) {
    return { ok: false, error: "Resend is not configured." };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, provider: "resend", error: `Resend failed (${res.status}): ${body}` };
  }

  return { ok: true, provider: "resend" };
}

async function sendWithSendGrid(
  to: string,
  subject: string,
  text: string
): Promise<DeliveryResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!isConfigured(apiKey) || !isConfigured(from)) {
    return { ok: false, error: "SendGrid is not configured." };
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: "text/plain", value: text }],
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, provider: "sendgrid", error: `SendGrid failed (${res.status}): ${body}` };
  }

  return { ok: true, provider: "sendgrid" };
}

function getEmailProvider() {
  if (isConfigured(process.env.RESEND_API_KEY) && isConfigured(process.env.EMAIL_FROM)) {
    return "resend" as const;
  }
  if (isConfigured(process.env.SENDGRID_API_KEY) && isConfigured(process.env.EMAIL_FROM)) {
    return "sendgrid" as const;
  }
  return null;
}

async function sendEmail(to: string, subject: string, text: string, html: string): Promise<DeliveryResult> {
  const provider = getEmailProvider();
  if (provider === "resend") return sendWithResend(to, subject, text, html);
  if (provider === "sendgrid") return sendWithSendGrid(to, subject, text);
  return {
    ok: false,
    error:
      "No email provider configured. Set RESEND_API_KEY + EMAIL_FROM or SENDGRID_API_KEY + EMAIL_FROM.",
  };
}

function getSmsConfigured() {
  return (
    isConfigured(process.env.TWILIO_ACCOUNT_SID) &&
    isConfigured(process.env.TWILIO_AUTH_TOKEN) &&
    isConfigured(process.env.TWILIO_FROM_NUMBER)
  );
}

async function sendSms(to: string, bodyText: string): Promise<DeliveryResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!getSmsConfigured() || !sid || !token || !from) {
    return {
      ok: false,
      error:
        "SMS provider not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.",
    };
  }

  const body = new URLSearchParams({ To: to, From: from, Body: bodyText });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const responseBody = await res.text();
    return { ok: false, provider: "twilio", error: `Twilio failed (${res.status}): ${responseBody}` };
  }

  return { ok: true, provider: "twilio" };
}

export function isChannelConfigured(channel: DeliveryChannel): { ok: boolean; reason?: string } {
  if (channel === "email") {
    const provider = getEmailProvider();
    return provider
      ? { ok: true }
      : {
          ok: false,
          reason:
            "Email not configured. Set RESEND_API_KEY + EMAIL_FROM or SENDGRID_API_KEY + EMAIL_FROM.",
        };
  }

  if (!getSmsConfigured()) {
    return {
      ok: false,
      reason: "SMS not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.",
    };
  }
  return { ok: true };
}

export async function sendPasswordReset(payload: PasswordResetPayload): Promise<DeliveryResult> {
  if (payload.channel === "email") {
    if (!payload.email) return { ok: false, error: "Missing recipient email." };
    const text =
      `We received a password reset request for your SiteSnap account.\n\n` +
      `Reset link: ${payload.resetLink}\n` +
      `Reset code: ${payload.resetCode}\n\n` +
      `If you did not request this, you can ignore this message.`;
    const html =
      `<p>We received a password reset request for your SiteSnap account.</p>` +
      `<p><a href="${payload.resetLink}">Reset your password</a></p>` +
      `<p>Or use this code: <strong>${payload.resetCode}</strong></p>` +
      `<p>If you did not request this, you can ignore this message.</p>`;
    return sendEmail(payload.email, "Reset your SiteSnap password", text, html);
  }

  if (!payload.phone) return { ok: false, error: "Missing recipient phone." };
  return sendSms(payload.phone, `SiteSnap reset code: ${payload.resetCode}. Link: ${payload.resetLink}`);
}

export async function sendAccountVerification(payload: VerificationPayload): Promise<DeliveryResult> {
  if (payload.channel === "email") {
    if (!payload.email) return { ok: false, error: "Missing recipient email." };
    const text =
      `Use this verification code to complete your SiteSnap signup: ${payload.code}\n\n` +
      `If you did not create this account, you can ignore this message.`;
    const html =
      `<p>Use this verification code to complete your SiteSnap signup:</p>` +
      `<p><strong>${payload.code}</strong></p>` +
      `<p>If you did not create this account, you can ignore this message.</p>`;
    return sendEmail(payload.email, "Verify your SiteSnap account", text, html);
  }

  if (!payload.phone) return { ok: false, error: "Missing recipient phone." };
  return sendSms(payload.phone, `Your SiteSnap verification code is: ${payload.code}`);
}
