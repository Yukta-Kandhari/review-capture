import nodemailer from "nodemailer";

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
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
    // Never put localhost links in emails when running on Render/production
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
  const transporter = getTransporter();
  if (!transporter) throw new Error("Email not configured — set SMTP_* in .env");

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

  const info = await transporter.sendMail(mail);
  console.log(
    `Email sent → to: ${to}${bccSender ? `, bcc: ${pmEmail()}` : ""}, messageId: ${info.messageId}`
  );
  return info;
}

/** One email to client: testimonial draft + sign link (sender BCC'd) */
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
  const transporter = getTransporter();
  if (!transporter) return { ok: false, error: "SMTP not configured" };
  try {
    await transporter.verify();
    return { ok: true, user: process.env.SMTP_USER };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export { baseUrl, pmEmail };
