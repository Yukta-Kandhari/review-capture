import nodemailer from "nodemailer";

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function baseUrl() {
  const url =
    process.env.PUBLIC_BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${process.env.PORT || process.env.HTTP_PORT || 3000}`;
  return url.replace(/\/$/, "");
}

function fromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_USER;
}

function pmEmail() {
  return process.env.PM_EMAIL || process.env.SMTP_USER;
}

function satisfactionEmailHtml(client, sessionId) {
  const yesUrl = `${baseUrl()}/r/${sessionId}/yes`;
  const noUrl = `${baseUrl()}/r/${sessionId}/no`;

  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <p>Hi ${client.contactName},</p>
  <p>We loved working with <strong>${client.name}</strong> on your project. Would you say you're happy with the service we provided?</p>
  <p style="margin: 32px 0;">
    <a href="${yesUrl}" style="background: #2eb67d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 12px; display: inline-block;">Yes, I love it ❤️</a>
    <a href="${noUrl}" style="background: #e01e5a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Not really</a>
  </p>
  <p style="color: #616061; font-size: 14px;">If the buttons don't work, copy and paste one of these links:<br>
  Yes: ${yesUrl}<br>No: ${noUrl}</p>
</body>
</html>`;
}

function signatureEmailHtml(client, reviewText, sessionId) {
  const signUrl = `${baseUrl()}/r/${sessionId}/sign`;

  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <p>Hi ${client.contactName},</p>
  <p>Here's your testimonial draft based on our work together:</p>
  <blockquote style="border-left: 4px solid #611f69; padding-left: 16px; margin: 24px 0; font-style: italic;">
    "${reviewText}"
  </blockquote>
  <p>By clicking below, you approve this text as your official testimonial.</p>
  <p style="margin: 32px 0;">
    <a href="${signUrl}" style="background: #611f69; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">✍️ Sign &amp; approve</a>
  </p>
</body>
</html>`;
}

async function sendMail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) throw new Error("Email not configured — set SMTP_* in .env");
  await transporter.sendMail({ from: fromAddress(), to, subject, html, text });
}

export async function sendSatisfactionEmail(client, sessionId) {
  if (!client.email) throw new Error(`No email for ${client.name}`);
  await sendMail({
    to: client.email,
    subject: `Quick question about our work together — ${client.name}`,
    html: satisfactionEmailHtml(client, sessionId),
    text: `Hi ${client.contactName},\n\nYes: ${baseUrl()}/r/${sessionId}/yes\nNo: ${baseUrl()}/r/${sessionId}/no`,
  });
}

export async function sendSignatureEmail(client, sessionId, reviewText) {
  await sendMail({
    to: client.email,
    subject: `Please review and sign your testimonial — ${client.name}`,
    html: signatureEmailHtml(client, reviewText, sessionId),
    text: `Hi ${client.contactName},\n\n"${reviewText}"\n\nSign: ${baseUrl()}/r/${sessionId}/sign`,
  });
}

export async function sendPmDraftReady(client, sessionId, draftText) {
  const approveUrl = `${baseUrl()}/admin/review/${sessionId}`;
  await sendMail({
    to: pmEmail(),
    subject: `Review draft ready — ${client.name}`,
    html: `<p>Draft for <strong>${client.name}</strong> (${client.contactName}):</p>
<blockquote style="font-style:italic;border-left:4px solid #611f69;padding-left:12px">${draftText}</blockquote>
<p><a href="${approveUrl}">Approve &amp; send for signature →</a></p>`,
    text: `Draft for ${client.name}:\n"${draftText}"\n\nApprove: ${approveUrl}`,
  });
}

export async function sendPmSigned(client, reviewText) {
  await sendMail({
    to: pmEmail(),
    subject: `✅ Review signed — ${client.name}`,
    html: `<p><strong>${client.contactName}</strong> at <strong>${client.name}</strong> signed their testimonial:</p>
<blockquote>${reviewText}</blockquote>`,
    text: `Signed by ${client.contactName} (${client.name}):\n"${reviewText}"`,
  });
}

export async function sendPmUnhappy(client) {
  await sendMail({
    to: pmEmail(),
    subject: `⚠️ Client not satisfied — ${client.name}`,
    html: `<p><strong>${client.contactName}</strong> at <strong>${client.name}</strong> indicated they're not fully satisfied. They were sent the feedback form.</p>`,
    text: `${client.contactName} at ${client.name} is not satisfied. Check feedback form responses.`,
  });
}

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export { baseUrl };
