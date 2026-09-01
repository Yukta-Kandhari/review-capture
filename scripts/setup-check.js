#!/usr/bin/env node
import "dotenv/config";

const hasSendGrid = Boolean(
  process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM && process.env.PM_EMAIL
);
const hasSmtp = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

console.log("\n🔍 Review Capture — Setup Check\n");
console.log(`${hasSendGrid ? "✅" : "⬜"} SendGrid HTTPS API`);
console.log(`${hasSmtp ? "✅" : "⬜"} SMTP fallback`);
console.log(`${process.env.PM_EMAIL ? "✅" : "⬜"} PM_EMAIL`);
console.log(`${process.env.APP_URL || process.env.RENDER_EXTERNAL_URL ? "✅" : "⬜"} Public app URL`);
console.log(`${process.env.ANTHROPIC_API_KEY ? "✅" : "⬜"} Anthropic API (optional)`);

if (!hasSendGrid && !hasSmtp) {
  console.log("\n❌ Configure SENDGRID_API_KEY + EMAIL_FROM + PM_EMAIL, or SMTP_*.");
  process.exitCode = 1;
} else {
  console.log(`\n✅ Email provider ready: ${hasSendGrid ? "SendGrid" : "SMTP"}`);
}
