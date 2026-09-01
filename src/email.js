import nodemailer from "nodemailer";

const SEND_TIMEOUT_MS = 20_000;

function isSendGridConfigured() {
  return Boolean(
    process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM && process.env.PM_EMAIL
  );
}

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

function baseUrl() {
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER_EXTERNAL_URL);

  const candidates = [
    process.env.APP_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.PUBLIC_BASE_URL,
  ]
    .filter(Boolean)
    .map((u) => u.replace(/\/$/, ""));

  for (const url of candidates) {
    if (isProd && url.includes("localhost")) continue;
    return url;
  }

  return `http://localhost:${process.env.PORT || process.env.HTTP_PORT || 3000}`;
}

function fromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_USER;
}

function pmEmail() {
  return process.env.PM_EMAIL || process.env.SMTP_USER;
}

function addressObject(address) {
  const match = address.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { email: match[2], name: match[1] } : { email: address };
}

async function sendWithSendGrid(mail) {
  const personalization = { to: [{ email: mail.to }] };
  if (mail.bcc) personalization.bcc = [{ email: mail.bcc }];

  const payload = {
    personalizations: [personalization],
    from: addressObject(mail.from),
    subject: mail.subject,
    content: [
      { type: "text/plain", value: mail.text },
      { type: "text/html", value: mail.html },
    ],
  };
  if (mail.replyTo) payload.reply_to = { email: mail.replyTo };

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const detail = result.errors?.map((error) => error.message).join("; ");
    throw new Error(`SendGrid API error (${response.status}): ${detail || response.statusText}`);
  }
  return {
    messageId: response.headers.get("x-message-id") || `sendgrid-${Date.now()}`,
  };
}

function reviewAndSignEmailHtml(client, reviewText, sessionId) {
  const signUrl = `${baseUrl()}/r/${sessionId}/sign`;

  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <p>Hi ${client.contactName},</p>
  <p>We loved working with <strong>${client.name}</strong> and would be grateful if you'd share a short testimonial. Based on our project together, we drafted this for you:</p>
  <blockquote style="border-left: 4px solid #611f69; padding-left: 16px; margin: 24px 0; font-style: italic;">
    "${reviewText}"
  </blockquote>
  <p>Happy with it? Click below to approve and sign. Want changes? Just reply to this email.</p>
  <p style="margin: 32px 0;">
    <a href="${signUrl}" style="background: #611f69; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">✍️ Sign &amp; approve</a>
  </p>
  <p style="color: #616061; font-size: 14px;">Or copy this link: ${signUrl}</p>
</body>
</html>`;
}

async function sendMail({ to, subject, html, text, bccSender = false }) {
  const mail = {
    from: fromAddress(),
    to,
    replyTo: pmEmail(),
    subject,
    html,
    text,
  };
  if (bccSender) {
    mail.bcc = pmEmail();
  }

  let info;
  if (isSendGridConfigured()) {
    info = await sendWithSendGrid(mail);
  } else {
    const transporter = getTransporter();
    if (!transporter) {
      throw new Error("Email not configured — set SENDGRID_API_KEY + EMAIL_FROM + PM_EMAIL or SMTP_*");
    }
    info = await withTimeout(
      transporter.sendMail(mail),
      SEND_TIMEOUT_MS,
      "Email send"
    );
  }

  console.log(
    `Email sent → to: ${to}${bccSender ? `, bcc: ${pmEmail()}` : ""}, messageId: ${info.messageId}`
  );
  return info;
}

export async function sendReviewAndSignEmail(client, sessionId, reviewText) {
  if (!client.email) throw new Error(`No email for ${client.name}`);
  const signUrl = `${baseUrl()}/r/${sessionId}/sign`;
  return sendMail({
    to: client.email,
    bccSender: true,
    subject: `Your testimonial for ${client.name} — please review & sign`,
    html: reviewAndSignEmailHtml(client, reviewText, sessionId),
    text: `Hi ${client.contactName},\n\n"${reviewText}"\n\nSign here: ${signUrl}`,
  });
}

export async function sendPmSigned(client, reviewText) {
  return sendMail({
    to: pmEmail(),
    bccSender: false,
    subject: `✅ Review signed — ${client.name}`,
    html: `<p><strong>${client.contactName}</strong> at <strong>${client.name}</strong> signed their testimonial:</p>
<blockquote>${reviewText}</blockquote>`,
    text: `Signed by ${client.contactName} (${client.name}):\n"${reviewText}"`,
  });
}

export async function verifyEmailConfig() {
  if (isSendGridConfigured()) {
    return { ok: true, user: process.env.EMAIL_FROM, provider: "SendGrid" };
  }
  const transporter = getTransporter();
  if (!transporter) {
    return { ok: false, error: "Set SENDGRID_API_KEY + EMAIL_FROM + PM_EMAIL or SMTP_*" };
  }
  try {
    await withTimeout(transporter.verify(), 10_000, "SMTP verify");
    return { ok: true, user: process.env.SMTP_USER };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function isEmailConfigured() {
  return isSendGridConfigured() || Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

export { baseUrl, pmEmail };
